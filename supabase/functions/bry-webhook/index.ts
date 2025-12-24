import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BrySigner {
  name: string;
  signatureStatus: string;
  signerNonce: string;
  signerUuid: string;
  email?: string;
}

interface BryDocument {
  documentUuid: string;
  documentNonce: string;
  currentDocumentLink?: { href: string };
  originalDocumentLink?: { href: string };
}

interface BryWebhookPayload {
  uuid: string;
  signer?: BrySigner;
  documents?: BryDocument[];
  status?: string;
  event?: string;
  signerNonce?: string;
  signerEmail?: string;
  documentUuid?: string;
}

// Nota: Carimbo do tempo criptográfico é aplicado automaticamente pela BRy
// através do signerSignatureConfig.profile = "TIMESTAMP" para assinaturas ADVANCED/QUALIFIED

async function getAccessToken(): Promise<string> {
  const clientId = Deno.env.get("BRY_CLIENT_ID");
  const clientSecret = Deno.env.get("BRY_CLIENT_SECRET");
  const environment = Deno.env.get("BRY_ENVIRONMENT") || "homologation";

  if (!clientId || !clientSecret) {
    throw new Error("BRy credentials not configured (BRY_CLIENT_ID / BRY_CLIENT_SECRET)");
  }

  const authUrl = "https://cloud.bry.com.br/token-service/jwt";

  console.log("[BRy Auth] Environment:", environment);
  console.log("[BRy Auth] Requesting token from:", authUrl);

  const basicAuth = btoa(`${clientId}:${clientSecret}`);

  const tokenResponse = await fetch(authUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: "grant_type=client_credentials",
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Failed to get BRy token: ${tokenResponse.status} - ${errorText}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

async function downloadSignedDocument(envelopeUuid: string, documentUuid: string): Promise<ArrayBuffer | null> {
  try {
    const accessToken = await getAccessToken();
    const environment = Deno.env.get("BRY_ENVIRONMENT") || "homologation";
    const apiBaseUrl = environment === "production" ? "https://easysign.bry.com.br" : "https://easysign.hom.bry.com.br";

    const downloadUrl = `${apiBaseUrl}/api/service/sign/v1/signatures/${envelopeUuid}/documents/${documentUuid}/signed`;
    console.log("Downloading signed document from:", downloadUrl);

    const downloadResponse = await fetch(downloadUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!downloadResponse.ok) {
      console.error("Failed to download signed document:", downloadResponse.status);
      return null;
    }

    return await downloadResponse.arrayBuffer();
  } catch (error) {
    console.error("Error downloading signed document:", error);
    return null;
  }
}

// Processa e finaliza UM documento específico
async function processDocument(supabase: any, document: any, envelopeUuid: string): Promise<void> {
  console.log("=== PROCESSING DOCUMENT ===");
  console.log("Document ID:", document.id);
  console.log("Document UUID:", document.bry_document_uuid);

  const documentUuid = document.bry_document_uuid;

  if (!documentUuid) {
    console.error("Document UUID not found for document:", document.id);
    return;
  }

  // Baixar documento assinado
  let signedPdf = await downloadSignedDocument(envelopeUuid, documentUuid);

  if (signedPdf) {
    // Carimbo do tempo criptográfico já aplicado pela BRy
    const finalPdf = signedPdf;

    // Upload do documento assinado
    const fileName = `${document.user_id}/${document.id}_signed.pdf`;

    const { error: uploadError } = await supabase.storage.from("documents").upload(fileName, finalPdf, {
      contentType: "application/pdf",
      upsert: true,
    });

    if (uploadError) {
      console.error("Error uploading signed document:", uploadError);
    } else {
      console.log("Signed document uploaded:", fileName);

      await supabase
        .from("documents")
        .update({
          status: "signed",
          bry_signed_file_url: fileName,
        })
        .eq("id", document.id);

      console.log("Document status updated to signed");
    }
  } else {
    console.error("Failed to download signed PDF for document:", document.id);
  }

  // Marcar todos os signatários deste documento como assinados
  await supabase
    .from("document_signers")
    .update({
      status: "signed",
      signed_at: new Date().toISOString(),
    })
    .eq("document_id", document.id)
    .eq("status", "pending");

  // Atualizar contagem
  const { data: allSigners } = await supabase.from("document_signers").select("id").eq("document_id", document.id);

  await supabase
    .from("documents")
    .update({
      signed_by: allSigners?.length || 0,
      status: "signed",
    })
    .eq("id", document.id);

  console.log("Document finalized:", document.id);
}

// Finaliza TODOS os documentos do envelope e envia notificações UMA vez
async function finalizeEnvelope(supabase: any, envelopeUuid: string): Promise<void> {
  console.log("=== FINALIZING ENVELOPE ===");
  console.log("Envelope UUID:", envelopeUuid);

  // Buscar TODOS os documentos com este envelope UUID
  const { data: documents, error: docsError } = await supabase
    .from("documents")
    .select("*")
    .eq("bry_envelope_uuid", envelopeUuid);

  if (docsError || !documents || documents.length === 0) {
    console.error("No documents found for envelope:", envelopeUuid);
    return;
  }

  console.log(`Found ${documents.length} documents in envelope`);

  // Processar cada documento
  for (const document of documents) {
    if (document.status !== "signed") {
      await processDocument(supabase, document, envelopeUuid);
    } else {
      console.log(`Document ${document.id} already signed, skipping`);
    }
  }

  // Enviar notificações de conclusão UMA VEZ (usando o primeiro documento para info)
  const firstDocument = documents[0];

  try {
    // Pegar signatários únicos (evitar duplicatas em envelope)
    const { data: signers } = await supabase
      .from("document_signers")
      .select("email, name, phone")
      .eq("document_id", firstDocument.id);

    if (signers && signers.length > 0) {
      const signerEmails = signers.map((s: any) => s.email).filter(Boolean);

      // Nome do envelope para notificação
      const envelopeName =
        documents.length > 1 ? `Envelope: ${firstDocument.name.split(" - ")[0]}` : firstDocument.name;

      // Enviar email de conclusão
      await supabase.functions.invoke("send-document-completed-email", {
        body: {
          documentId: firstDocument.id,
          documentName: envelopeName,
          signerEmails,
          senderName: "eonSign",
        },
      });
      console.log("Document completed email sent");

      // Enviar WhatsApp de conclusão com link de validação
      const APP_URL = Deno.env.get("APP_URL") || "https://sign.eonhub.com.br";
      const validationUrl = `${APP_URL}/validar/${firstDocument.id}`;
      
      for (const signer of signers) {
        if (signer.phone) {
          try {
            await supabase.functions.invoke("send-whatsapp-message", {
              body: {
                signerName: signer.name,
                signerPhone: signer.phone,
                documentName: envelopeName,
                documentId: firstDocument.id,
                organizationName: "Eon Sign",
                isCompleted: true,
                validationUrl: validationUrl,
              },
            });
            console.log(`WhatsApp sent to ${signer.phone}`);
          } catch (waError) {
            console.error(`Error sending WhatsApp to ${signer.phone}:`, waError);
          }
        }
      }
    }
  } catch (emailError) {
    console.error("Error sending completed notifications:", emailError);
  }

  console.log("=== ENVELOPE FINALIZATION COMPLETE ===");
}

const handler = async (req: Request): Promise<Response> => {
  const timestamp = new Date().toISOString();
  console.log("=== BRY WEBHOOK CALLED ===");
  console.log("Timestamp:", timestamp);
  console.log("Method:", req.method);
  console.log("Request URL:", req.url);
  console.log("Request Headers:", JSON.stringify(Object.fromEntries(req.headers.entries())));

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const rawBody = await req.text();
    console.log("Raw webhook body:", rawBody);

    const payload: BryWebhookPayload = JSON.parse(rawBody);
    console.log("BRy webhook parsed payload:", JSON.stringify(payload));

    const envelopeUuid = payload.uuid;
    const envelopeStatus = payload.status;
    const signerNonce = payload.signer?.signerNonce || payload.signerNonce;
    const signerStatus = payload.signer?.signatureStatus;
    const signerEmail = payload.signer?.email || payload.signerEmail;
    const legacyEvent = payload.event;

    console.log("Envelope UUID:", envelopeUuid);
    console.log("Envelope Status:", envelopeStatus);
    console.log("Signer Nonce:", signerNonce);
    console.log("Signer Status:", signerStatus);

    // Buscar TODOS os documentos do envelope
    const { data: documents, error: docsError } = await supabase
      .from("documents")
      .select("*")
      .eq("bry_envelope_uuid", envelopeUuid);

    if (docsError || !documents || documents.length === 0) {
      // Tentar buscar por nonce do signatário
      if (signerNonce) {
        const { data: signerData } = await supabase
          .from("document_signers")
          .select("document_id")
          .eq("bry_signer_nonce", signerNonce)
          .maybeSingle();

        if (signerData) {
          const { data: docByNonce } = await supabase
            .from("documents")
            .select("bry_envelope_uuid")
            .eq("id", signerData.document_id)
            .single();

          if (docByNonce?.bry_envelope_uuid) {
            console.log("Found envelope via signer nonce");
          }
        }
      }

      console.error("Documents not found for envelope UUID:", envelopeUuid);
      return new Response(JSON.stringify({ error: "Documents not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${documents.length} documents in envelope`);

    // Verificar se signatário completou assinatura
    const isSignerCompleted =
      signerStatus === "SIGNED" || legacyEvent === "SIGNER_COMPLETED" || legacyEvent === "SIGNATURE_COMPLETED";

    if (isSignerCompleted) {
      console.log("=== SIGNER COMPLETED ===");
      console.log("Signer Email:", signerEmail);
      console.log("Signer Nonce:", signerNonce);

      // Atualizar status do signatário em TODOS os documentos do envelope
      for (const document of documents) {
        console.log(`Processing document: ${document.id}`);
        
        // Buscar signatário usando correspondência case-insensitive ou nonce
        const { data: localSigners } = await supabase
          .from("document_signers")
          .select("*")
          .eq("document_id", document.id)
          .eq("status", "pending");

        if (!localSigners || localSigners.length === 0) {
          console.log(`No pending signers for document: ${document.id}`);
          continue;
        }

        // IMPROVED MATCHING: Case-insensitive email + nonce fallback
        const signerEmailLower = signerEmail?.toLowerCase().trim();
        
        const matchedSigner = localSigners.find((local: any) => {
          const localEmailLower = local.email?.toLowerCase().trim();
          const localNonce = local.bry_signer_nonce;

          // Match by nonce first (most reliable)
          if (signerNonce && localNonce && signerNonce === localNonce) {
            console.log(`✓ Matched by nonce: ${signerNonce}`);
            return true;
          }

          // Fallback to case-insensitive email match
          if (signerEmailLower && localEmailLower && signerEmailLower === localEmailLower) {
            console.log(`✓ Matched by email (case-insensitive): ${localEmailLower}`);
            return true;
          }

          return false;
        });

        if (matchedSigner) {
          console.log(`Updating signer ${matchedSigner.id} (${matchedSigner.email}) to signed`);
          
          await supabase
            .from("document_signers")
            .update({
              status: "signed",
              signed_at: new Date().toISOString(),
            })
            .eq("id", matchedSigner.id);
        } else {
          console.log(`⚠ No matching signer found for email: ${signerEmail}, nonce: ${signerNonce}`);
        }

        // Atualizar contagem no documento
        const { data: signedSigners } = await supabase
          .from("document_signers")
          .select("id")
          .eq("document_id", document.id)
          .eq("status", "signed");

        await supabase
          .from("documents")
          .update({ signed_by: signedSigners?.length || 0 })
          .eq("id", document.id);
      }

      // Verificar se TODOS os signatários assinaram (usando primeiro documento)
      const { data: allSigners } = await supabase
        .from("document_signers")
        .select("id, status")
        .eq("document_id", documents[0].id);

      const totalSigners = allSigners?.length || 0;
      const signedCount = allSigners?.filter((s: any) => s.status === "signed").length || 0;

      console.log(`Signature progress: ${signedCount}/${totalSigners}`);

      // Se todos assinaram, finalizar TODO o envelope
      if (totalSigners > 0 && signedCount === totalSigners) {
        const anyUnsigned = documents.some((d: any) => d.status !== "signed");
        if (anyUnsigned) {
          console.log("=== ALL SIGNERS COMPLETED - FINALIZING ENVELOPE ===");
          await finalizeEnvelope(supabase, envelopeUuid);
        }
      }
    }

    // Verificar se envelope foi completado via evento explícito
    const isEnvelopeCompleted =
      envelopeStatus === "COMPLETED" ||
      envelopeStatus === "SIGNED" ||
      envelopeStatus === "FINISHED" ||
      legacyEvent === "ENVELOPE_COMPLETED" ||
      legacyEvent === "SIGNATURE_ALL_COMPLETED";

    if (isEnvelopeCompleted) {
      const anyUnsigned = documents.some((d: any) => d.status !== "signed");
      if (anyUnsigned) {
        console.log("=== ENVELOPE COMPLETED EVENT - FINALIZING ===");
        await finalizeEnvelope(supabase, envelopeUuid);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in bry-webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
