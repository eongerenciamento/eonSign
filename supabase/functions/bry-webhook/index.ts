import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function stampPdf(pdfBuffer: ArrayBuffer): Promise<ArrayBuffer | null> {
  try {
    const base64Pdf = arrayBufferToBase64(pdfBuffer);
    console.log('Calling stamp API...');
    
    const response = await fetch('https://example.com/fw/v1/pdf/carimbar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pdf: base64Pdf }),
    });

    if (!response.ok) {
      console.error('Stamp API failed:', response.status);
      return null;
    }

    const result = await response.json();
    
    if (result.pdf) {
      console.log('PDF stamped successfully');
      return base64ToArrayBuffer(result.pdf);
    }
    
    console.error('Stamp API response missing pdf field');
    return null;
  } catch (error) {
    console.error('Error stamping PDF:', error);
    return null;
  }
}

async function getAccessToken(): Promise<string> {
  const clientId = Deno.env.get('BRY_CLIENT_ID');
  const clientSecret = Deno.env.get('BRY_CLIENT_SECRET');
  const environment = Deno.env.get('BRY_ENVIRONMENT') || 'homologation';
  
  const tokenBaseUrl = environment === 'production' 
    ? 'https://cloud.bry.com.br'
    : 'https://cloud-hom.bry.com.br';

  const tokenResponse = await fetch(`${tokenBaseUrl}/token-service/jwt`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId!,
      client_secret: clientSecret!,
    }).toString(),
  });

  if (!tokenResponse.ok) {
    throw new Error('Failed to get BRy token');
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

async function downloadSignedDocument(envelopeUuid: string, documentUuid: string): Promise<ArrayBuffer | null> {
  try {
    const accessToken = await getAccessToken();
    const environment = Deno.env.get('BRY_ENVIRONMENT') || 'homologation';
    const apiBaseUrl = environment === 'production'
      ? 'https://easysign.bry.com.br'
      : 'https://easysign.hom.bry.com.br';

    const downloadUrl = `${apiBaseUrl}/api/service/sign/v1/signatures/${envelopeUuid}/documents/${documentUuid}/signed`;
    console.log('Downloading signed document from:', downloadUrl);

    const downloadResponse = await fetch(downloadUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!downloadResponse.ok) {
      console.error('Failed to download signed document:', downloadResponse.status);
      return null;
    }

    return await downloadResponse.arrayBuffer();
  } catch (error) {
    console.error('Error downloading signed document:', error);
    return null;
  }
}

// Processa e finaliza UM documento específico
async function processDocument(
  supabase: any,
  document: any,
  envelopeUuid: string
): Promise<void> {
  console.log('=== PROCESSING DOCUMENT ===');
  console.log('Document ID:', document.id);
  console.log('Document UUID:', document.bry_document_uuid);

  const documentUuid = document.bry_document_uuid;
  
  if (!documentUuid) {
    console.error('Document UUID not found for document:', document.id);
    return;
  }

  // Baixar documento assinado
  let signedPdf = await downloadSignedDocument(envelopeUuid, documentUuid);

  if (signedPdf) {
    // Carimbar o PDF
    console.log('Stamping signed PDF...');
    const stampedPdf = await stampPdf(signedPdf);
    const finalPdf = stampedPdf || signedPdf;

    // Upload do documento assinado
    const fileName = `${document.user_id}/${document.id}_signed.pdf`;
    
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, finalPdf, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      console.error('Error uploading signed document:', uploadError);
    } else {
      console.log('Signed document uploaded:', fileName);

      await supabase
        .from('documents')
        .update({
          status: 'signed',
          bry_signed_file_url: fileName,
        })
        .eq('id', document.id);

      console.log('Document status updated to signed');
    }
  } else {
    console.error('Failed to download signed PDF for document:', document.id);
  }

  // Marcar todos os signatários deste documento como assinados
  await supabase
    .from('document_signers')
    .update({
      status: 'signed',
      signed_at: new Date().toISOString(),
    })
    .eq('document_id', document.id)
    .eq('status', 'pending');

  // Atualizar contagem
  const { data: allSigners } = await supabase
    .from('document_signers')
    .select('id')
    .eq('document_id', document.id);

  await supabase
    .from('documents')
    .update({ 
      signed_by: allSigners?.length || 0,
      status: 'signed',
    })
    .eq('id', document.id);

  console.log('Document finalized:', document.id);
}

// Finaliza TODOS os documentos do envelope e envia notificações UMA vez
async function finalizeEnvelope(
  supabase: any,
  envelopeUuid: string
): Promise<void> {
  console.log('=== FINALIZING ENVELOPE ===');
  console.log('Envelope UUID:', envelopeUuid);

  // Buscar TODOS os documentos com este envelope UUID
  const { data: documents, error: docsError } = await supabase
    .from('documents')
    .select('*')
    .eq('bry_envelope_uuid', envelopeUuid);

  if (docsError || !documents || documents.length === 0) {
    console.error('No documents found for envelope:', envelopeUuid);
    return;
  }

  console.log(`Found ${documents.length} documents in envelope`);

  // Processar cada documento
  for (const document of documents) {
    if (document.status !== 'signed') {
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
      .from('document_signers')
      .select('email, name, phone')
      .eq('document_id', firstDocument.id);

    if (signers && signers.length > 0) {
      const signerEmails = signers.map((s: any) => s.email).filter(Boolean);
      
      // Nome do envelope para notificação
      const envelopeName = documents.length > 1 
        ? `Envelope: ${firstDocument.name.split(' - ')[0]}` 
        : firstDocument.name;

      // Enviar email de conclusão
      await supabase.functions.invoke('send-document-completed-email', {
        body: {
          documentId: firstDocument.id,
          documentName: envelopeName,
          signerEmails,
          senderName: 'Eon Sign',
        },
      });
      console.log('Document completed email sent');

      // Enviar WhatsApp de conclusão
      for (const signer of signers) {
        if (signer.phone) {
          try {
            await supabase.functions.invoke('send-whatsapp-message', {
              body: {
                signerName: signer.name,
                signerPhone: signer.phone,
                documentName: envelopeName,
                documentId: firstDocument.id,
                messageType: 'completed',
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
    console.error('Error sending completed notifications:', emailError);
  }

  console.log('=== ENVELOPE FINALIZATION COMPLETE ===');
}

const handler = async (req: Request): Promise<Response> => {
  console.log('=== BRY WEBHOOK CALLED ===');
  console.log('Method:', req.method);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const rawBody = await req.text();
    console.log('Raw webhook body:', rawBody);
    
    const payload: BryWebhookPayload = JSON.parse(rawBody);
    console.log('BRy webhook parsed payload:', JSON.stringify(payload));

    const envelopeUuid = payload.uuid;
    const envelopeStatus = payload.status;
    const signerNonce = payload.signer?.signerNonce || payload.signerNonce;
    const signerStatus = payload.signer?.signatureStatus;
    const signerEmail = payload.signer?.email || payload.signerEmail;
    const legacyEvent = payload.event;

    console.log('Envelope UUID:', envelopeUuid);
    console.log('Envelope Status:', envelopeStatus);
    console.log('Signer Nonce:', signerNonce);
    console.log('Signer Status:', signerStatus);

    // Buscar TODOS os documentos do envelope
    const { data: documents, error: docsError } = await supabase
      .from('documents')
      .select('*')
      .eq('bry_envelope_uuid', envelopeUuid);

    if (docsError || !documents || documents.length === 0) {
      // Tentar buscar por nonce do signatário
      if (signerNonce) {
        const { data: signerData } = await supabase
          .from('document_signers')
          .select('document_id')
          .eq('bry_signer_nonce', signerNonce)
          .maybeSingle();
        
        if (signerData) {
          const { data: docByNonce } = await supabase
            .from('documents')
            .select('bry_envelope_uuid')
            .eq('id', signerData.document_id)
            .single();
          
          if (docByNonce?.bry_envelope_uuid) {
            console.log('Found envelope via signer nonce');
          }
        }
      }
      
      console.error('Documents not found for envelope UUID:', envelopeUuid);
      return new Response(JSON.stringify({ error: 'Documents not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${documents.length} documents in envelope`);

    // Verificar se signatário completou assinatura
    const isSignerCompleted = signerStatus === 'SIGNED' || 
                              legacyEvent === 'SIGNER_COMPLETED' || 
                              legacyEvent === 'SIGNATURE_COMPLETED';

    if (isSignerCompleted) {
      console.log('=== SIGNER COMPLETED ===');
      
      // Atualizar status do signatário em TODOS os documentos do envelope
      for (const document of documents) {
        let query = supabase
          .from('document_signers')
          .update({
            status: 'signed',
            signed_at: new Date().toISOString(),
          })
          .eq('document_id', document.id);

        if (signerNonce) {
          query = query.eq('bry_signer_nonce', signerNonce);
        } else if (signerEmail) {
          query = query.eq('email', signerEmail);
        }

        await query;

        // Atualizar contagem no documento
        const { data: signedSigners } = await supabase
          .from('document_signers')
          .select('id')
          .eq('document_id', document.id)
          .eq('status', 'signed');

        await supabase
          .from('documents')
          .update({ signed_by: signedSigners?.length || 0 })
          .eq('id', document.id);
      }

      // Verificar se TODOS os signatários assinaram (usando primeiro documento)
      const { data: allSigners } = await supabase
        .from('document_signers')
        .select('id, status')
        .eq('document_id', documents[0].id);

      const totalSigners = allSigners?.length || 0;
      const signedCount = allSigners?.filter((s: any) => s.status === 'signed').length || 0;
      
      console.log(`Signature progress: ${signedCount}/${totalSigners}`);

      // Se todos assinaram, finalizar TODO o envelope
      if (totalSigners > 0 && signedCount === totalSigners) {
        const anyUnsigned = documents.some((d: any) => d.status !== 'signed');
        if (anyUnsigned) {
          console.log('=== ALL SIGNERS COMPLETED - FINALIZING ENVELOPE ===');
          await finalizeEnvelope(supabase, envelopeUuid);
        }
      }
    }

    // Verificar se envelope foi completado via evento explícito
    const isEnvelopeCompleted = envelopeStatus === 'COMPLETED' || 
                                envelopeStatus === 'SIGNED' ||
                                envelopeStatus === 'FINISHED' ||
                                legacyEvent === 'ENVELOPE_COMPLETED' || 
                                legacyEvent === 'SIGNATURE_ALL_COMPLETED';

    if (isEnvelopeCompleted) {
      const anyUnsigned = documents.some((d: any) => d.status !== 'signed');
      if (anyUnsigned) {
        console.log('=== ENVELOPE COMPLETED EVENT - FINALIZING ===');
        await finalizeEnvelope(supabase, envelopeUuid);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in bry-webhook:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

serve(handler);
