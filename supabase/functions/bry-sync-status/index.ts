import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Função para converter ArrayBuffer para base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Função para converter base64 para ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Função para carimbar o PDF
async function stampPdf(pdfBuffer: ArrayBuffer): Promise<ArrayBuffer | null> {
  try {
    const base64Pdf = arrayBufferToBase64(pdfBuffer);
    console.log("Calling stamp API...");

    const response = await fetch("https://example.com/fw/v1/pdf/carimbar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ pdf: base64Pdf }),
    });

    if (!response.ok) {
      console.error("Stamp API failed:", response.status);
      return null;
    }

    const result = await response.json();

    if (result.pdf) {
      console.log("PDF stamped successfully");
      return base64ToArrayBuffer(result.pdf);
    }

    console.error("Stamp API response missing pdf field");
    return null;
  } catch (error) {
    console.error("Error stamping PDF:", error);
    return null;
  }
}

async function getToken(): Promise<string> {
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

async function downloadSignedDocument(
  envelopeUuid: string,
  documentUuid: string,
  accessToken: string,
): Promise<ArrayBuffer | null> {
  try {
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

interface SyncResult {
  documentId: string;
  success: boolean;
  changed: boolean;
  signedCount?: number;
  totalSigners?: number;
  completed?: boolean;
  error?: string;
}

async function syncSingleDocument(supabase: any, documentId: string, accessToken: string): Promise<SyncResult> {
  console.log(`\n========================================`);
  console.log(`[Sync] Starting sync for document: ${documentId}`);
  console.log(`========================================`);

  try {
    // Buscar documento
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (docError || !document) {
      console.log(`[Sync] Document not found: ${documentId}`);
      return { documentId, success: false, changed: false, error: "Document not found" };
    }

    console.log(`[Sync] Document: ${document.name}, Status: ${document.status}, signed_by: ${document.signed_by}`);

    if (!document.bry_envelope_uuid) {
      console.log(`[Sync] No BRy envelope UUID for document: ${documentId}`);
      return { documentId, success: false, changed: false, error: "No BRy envelope" };
    }

    console.log(`[Sync] BRy envelope UUID: ${document.bry_envelope_uuid}`);

    const environment = Deno.env.get("BRY_ENVIRONMENT") || "homologation";
    const apiBaseUrl = environment === "production" ? "https://easysign.bry.com.br" : "https://easysign.hom.bry.com.br";

    // Tentar endpoint completo do envelope primeiro (retorna signers e documents)
    const envelopeUrl = `${apiBaseUrl}/api/service/sign/v1/signatures/${document.bry_envelope_uuid}`;
    console.log(`[Sync] Fetching BRy envelope from: ${envelopeUrl}`);

    const envelopeResponse = await fetch(envelopeUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    let statusData: any = {};

    if (envelopeResponse.ok) {
      statusData = await envelopeResponse.json();
      console.log(`[Sync] BRy envelope data received:`, JSON.stringify(statusData, null, 2));
    } else {
      // Fallback para endpoint de status
      console.log("[Sync] Envelope endpoint failed, trying status endpoint...");
      const statusUrl = `${apiBaseUrl}/api/service/sign/v1/signatures/${document.bry_envelope_uuid}/status`;

      const statusResponse = await fetch(statusUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!statusResponse.ok) {
        const errorText = await statusResponse.text();
        console.error(`[Sync] Failed to get BRy status: ${statusResponse.status} - ${errorText}`);
        return { documentId, success: false, changed: false, error: "Failed to get BRy status" };
      }

      statusData = await statusResponse.json();
      console.log(`[Sync] BRy status data received:`, JSON.stringify(statusData, null, 2));
    }

    // Processar status dos signatários
    let signedCount = 0;
    let hasChanges = false;
    const previousSignedBy = document.signed_by || 0;

    // BRy pode retornar signers no nivel raiz ou dentro de documents
    const signersList = statusData.signers || statusData.subscribers || [];
    const documentsList = statusData.documents || [];

    console.log(`[Sync] BRy signers count: ${signersList.length}, documents count: ${documentsList.length}`);

    // Log detalhado de todos os signatários da BRy para debug
    console.log(`[Sync] === BRy Signers Details ===`);
    signersList.forEach((brySigner: any, index: number) => {
      console.log(`[Sync] BRy Signer ${index + 1}:`, {
        email: brySigner.email,
        emailLower: brySigner.email?.toLowerCase(),
        name: brySigner.name,
        status: brySigner.status,
        signatureStatus: brySigner.signatureStatus,
        signerNonce: brySigner.signerNonce,
        signedAt: brySigner.signedAt,
      });
    });

    // Buscar signatários locais para comparação
    const { data: localSigners } = await supabase
      .from("document_signers")
      .select("*")
      .eq("document_id", documentId);

    console.log(`[Sync] === Local Signers Details ===`);
    localSigners?.forEach((localSigner: any, index: number) => {
      console.log(`[Sync] Local Signer ${index + 1}:`, {
        id: localSigner.id,
        email: localSigner.email,
        emailLower: localSigner.email?.toLowerCase(),
        name: localSigner.name,
        status: localSigner.status,
        bry_signer_nonce: localSigner.bry_signer_nonce,
        signed_at: localSigner.signed_at,
      });
    });

    // Extrair documentUuid se não temos
    if (!document.bry_document_uuid && documentsList.length > 0) {
      const docUuid = documentsList[0].documentUuid || documentsList[0].uuid;
      if (docUuid) {
        await supabase.from("documents").update({ bry_document_uuid: docUuid }).eq("id", documentId);
        console.log(`[Sync] Updated bry_document_uuid: ${docUuid}`);
      }
    }

    if (signersList.length > 0) {
      for (const brySigner of signersList) {
        const isCompleted = 
          brySigner.status === "COMPLETED" || 
          brySigner.status === "SIGNED" ||
          brySigner.signatureStatus === "SIGNED" ||
          brySigner.signatureStatus === "COMPLETED";
        
        console.log(`\n[Sync] Processing BRy signer: ${brySigner.email}`);
        console.log(`[Sync]   status=${brySigner.status}, signatureStatus=${brySigner.signatureStatus}, isCompleted=${isCompleted}`);

        if (isCompleted) {
          signedCount++;

          // IMPROVED MATCHING: Case-insensitive email + nonce fallback
          const bryEmailLower = brySigner.email?.toLowerCase().trim();
          const bryNonce = brySigner.signerNonce;

          console.log(`[Sync]   Looking for local match with email (case-insensitive): "${bryEmailLower}" OR nonce: "${bryNonce}"`);

          // Find matching local signer
          const matchedLocalSigner = localSigners?.find((local: any) => {
            const localEmailLower = local.email?.toLowerCase().trim();
            const localNonce = local.bry_signer_nonce;

            // Match by nonce first (most reliable)
            if (bryNonce && localNonce && bryNonce === localNonce) {
              console.log(`[Sync]   ✓ Matched by nonce: ${bryNonce}`);
              return true;
            }

            // Fallback to case-insensitive email match
            if (bryEmailLower && localEmailLower && bryEmailLower === localEmailLower) {
              console.log(`[Sync]   ✓ Matched by email (case-insensitive): ${localEmailLower}`);
              return true;
            }

            return false;
          });

          if (!matchedLocalSigner) {
            console.log(`[Sync]   ⚠ No local match found for BRy signer: ${brySigner.email} (nonce: ${bryNonce})`);
            continue;
          }

          console.log(`[Sync]   Matched to local signer ID: ${matchedLocalSigner.id}, current status: ${matchedLocalSigner.status}`);

          // Only update if local status is still pending
          if (matchedLocalSigner.status !== "signed") {
            const { data: updated, error: updateError } = await supabase
              .from("document_signers")
              .update({
                status: "signed",
                signed_at: brySigner.signedAt || brySigner.completedAt || new Date().toISOString(),
              })
              .eq("id", matchedLocalSigner.id)
              .select();

            if (updateError) {
              console.error(`[Sync]   Error updating signer: ${updateError.message}`);
            } else if (updated && updated.length > 0) {
              hasChanges = true;
              console.log(`[Sync]   ✓ Signer ${matchedLocalSigner.email} marked as signed`);
            }
          } else {
            console.log(`[Sync]   Signer already marked as signed locally`);
          }
        }
      }
    } else {
      // Se não há signers na resposta, buscar do banco para contar
      console.log(`[Sync] No signers in BRy response, counting from local DB`);
      const { data: dbSigners } = await supabase
        .from("document_signers")
        .select("status")
        .eq("document_id", documentId);

      if (dbSigners) {
        signedCount = dbSigners.filter((s: { status: string }) => s.status === "signed").length;
        console.log(`[Sync] Local signed count: ${signedCount}`);
      }
    }

    // Verificar se contagem mudou
    if (signedCount !== previousSignedBy) {
      hasChanges = true;
    }

    // Verificar se todos assinaram (BRy usa FINISHED, COMPLETED ou SIGNED)
    const envelopeCompleted =
      statusData.status === "COMPLETED" || statusData.status === "SIGNED" || statusData.status === "FINISHED";
    const totalSigners = signersList.length || document.signers || 0;

    if (envelopeCompleted && document.status !== "signed") {
      console.log(`All signatures completed for ${documentId}, downloading signed document`);
      hasChanges = true;

      // Obter document UUID se necessário
      let docUuid = document.bry_document_uuid;
      if (!docUuid && documentsList.length > 0) {
        docUuid = documentsList[0].documentUuid || documentsList[0].uuid;
      }

      if (docUuid) {
        // Baixar documento assinado
        let signedPdf = await downloadSignedDocument(document.bry_envelope_uuid, docUuid, accessToken);

        if (signedPdf) {
          // Carimbar o PDF antes de fazer upload
          console.log("Stamping signed PDF...");
          const stampedPdf = await stampPdf(signedPdf);

          // Usar PDF carimbado se disponível, senão usar original
          const finalPdf = stampedPdf || signedPdf;
          if (stampedPdf) {
            console.log("Using stamped PDF");
          } else {
            console.log("Stamp failed, using original signed PDF");
          }

          const fileName = `${document.user_id}/${document.id}_signed.pdf`;

          const { error: uploadError } = await supabase.storage.from("documents").upload(fileName, finalPdf, {
            contentType: "application/pdf",
            upsert: true,
          });

          if (uploadError) {
            console.error("Error uploading signed document:", uploadError);
          } else {
            console.log("Signed document uploaded:", fileName);

            // Atualizar documento
            await supabase
              .from("documents")
              .update({
                status: "signed",
                bry_signed_file_url: fileName,
                bry_document_uuid: docUuid,
                signed_by: signedCount,
              })
              .eq("id", documentId);

            console.log("Document status updated to signed");

            // Enviar email e WhatsApp de conclusão
            try {
              const { data: signers } = await supabase
                .from("document_signers")
                .select("email, name, phone")
                .eq("document_id", documentId);

              if (signers && signers.length > 0) {
                const signerEmails = signers.map((s: { email: string }) => s.email);

                // Enviar email de conclusão
                await supabase.functions.invoke("send-document-completed-email", {
                  body: {
                    documentId: document.id,
                    documentName: document.name,
                    signerEmails,
                    senderName: "eonSign",
                  },
                });
                console.log("Document completed email sent");

                // Enviar WhatsApp de conclusão para cada signatário com telefone
                for (const signer of signers) {
                  if (signer.phone) {
                    try {
                      await supabase.functions.invoke("send-whatsapp-message", {
                        body: {
                          signerName: signer.name,
                          signerPhone: signer.phone,
                          documentName: document.name,
                          documentId: document.id,
                          messageType: "completed",
                        },
                      });
                      console.log(`Document completed WhatsApp sent to ${signer.phone}`);
                    } catch (waError) {
                      console.error(`Error sending WhatsApp to ${signer.phone}:`, waError);
                    }
                  }
                }
              }
            } catch (emailError) {
              console.error("Error sending completed notifications:", emailError);
            }
          }
        }
      } else {
        console.error("No document UUID available to download signed PDF");
      }

      return {
        documentId,
        success: true,
        changed: hasChanges,
        signedCount,
        totalSigners,
        completed: true,
      };
    } else if (hasChanges) {
      // Atualizar apenas contagem de assinaturas
      await supabase.from("documents").update({ signed_by: signedCount }).eq("id", documentId);
    }

    return {
      documentId,
      success: true,
      changed: hasChanges,
      signedCount,
      totalSigners,
      completed: envelopeCompleted,
    };
  } catch (error: any) {
    console.error(`Error syncing document ${documentId}:`, error);
    return { documentId, success: false, changed: false, error: error.message };
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();

    // Support both single documentId and array of documentIds
    const documentIds: string[] = body.documentIds || (body.documentId ? [body.documentId] : []);

    if (documentIds.length === 0) {
      return new Response(JSON.stringify({ error: "documentId or documentIds is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Syncing BRy status for ${documentIds.length} documents`);

    // Get BRy token once for all documents
    const accessToken = await getToken();
    console.log("BRy token obtained");

    // Process all documents
    const results: SyncResult[] = await Promise.all(
      documentIds.map((id) => syncSingleDocument(supabase, id, accessToken)),
    );

    // For single document requests, return backward-compatible response
    if (body.documentId && !body.documentIds) {
      const result = results[0];
      return new Response(
        JSON.stringify({
          success: result.success,
          signedCount: result.signedCount,
          totalSigners: result.totalSigners,
          completed: result.completed,
          changed: result.changed,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // For multiple documents, return array of results
    return new Response(
      JSON.stringify({
        success: true,
        results,
        totalChanged: results.filter((r) => r.changed).length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    console.error("Error in bry-sync-status:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
