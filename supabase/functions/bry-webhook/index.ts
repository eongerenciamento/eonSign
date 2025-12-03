import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Interfaces baseadas no payload real da BRy
interface BrySigner {
  name: string;
  signatureStatus: string; // 'SIGNED', 'PENDING', etc.
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
  uuid: string;           // Envelope UUID
  signer?: BrySigner;     // Informações do signatário (presente quando signatário assina)
  documents?: BryDocument[];
  status?: string;        // Status do envelope ('COMPLETED', 'SIGNED', etc.)
  // Campos legados para compatibilidade
  event?: string;
  signerNonce?: string;
  signerEmail?: string;
  documentUuid?: string;
}

async function downloadSignedDocument(envelopeUuid: string, documentUuid: string): Promise<ArrayBuffer | null> {
  try {
    const clientId = Deno.env.get('BRY_CLIENT_ID');
    const clientSecret = Deno.env.get('BRY_CLIENT_SECRET');
    const environment = Deno.env.get('BRY_ENVIRONMENT') || 'homologation';
    
    const tokenBaseUrl = environment === 'production' 
      ? 'https://cloud.bry.com.br'
      : 'https://cloud-hom.bry.com.br';

    // Obter token
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
      console.error('Failed to get token for download');
      return null;
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    const apiBaseUrl = environment === 'production'
      ? 'https://easysign.bry.com.br'
      : 'https://easysign.hom.bry.com.br';

    // Baixar documento assinado
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

const handler = async (req: Request): Promise<Response> => {
  console.log('=== BRY WEBHOOK CALLED ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', JSON.stringify(Object.fromEntries(req.headers.entries())));

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

    // Extrair dados do payload - suporta tanto formato novo quanto legado
    const envelopeUuid = payload.uuid;
    const envelopeStatus = payload.status;
    
    // Dados do signatário - formato novo (signer object) ou legado
    const signerNonce = payload.signer?.signerNonce || payload.signerNonce;
    const signerStatus = payload.signer?.signatureStatus;
    const signerEmail = payload.signer?.email || payload.signerEmail;
    
    // Documento UUID - do array documents ou campo legado
    const documentUuid = payload.documents?.[0]?.documentUuid || payload.documentUuid;
    
    // Evento legado
    const legacyEvent = payload.event;

    console.log('=== PARSED DATA ===');
    console.log('Envelope UUID:', envelopeUuid);
    console.log('Envelope Status:', envelopeStatus);
    console.log('Signer Nonce:', signerNonce);
    console.log('Signer Status:', signerStatus);
    console.log('Signer Email:', signerEmail);
    console.log('Document UUID:', documentUuid);
    console.log('Legacy Event:', legacyEvent);

    // Buscar documento pelo envelope UUID
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('bry_envelope_uuid', envelopeUuid)
      .maybeSingle();

    if (docError) {
      console.error('Database error finding document:', docError);
    }

    if (!document) {
      console.error('Document not found for envelope UUID:', envelopeUuid);
      // Tentar buscar por nonce do signatário
      if (signerNonce) {
        console.log('Attempting to find document by signer nonce:', signerNonce);
        const { data: signerData } = await supabase
          .from('document_signers')
          .select('document_id')
          .eq('bry_signer_nonce', signerNonce)
          .maybeSingle();
        
        if (signerData) {
          console.log('Found document via signer nonce:', signerData.document_id);
          const { data: docByNonce } = await supabase
            .from('documents')
            .select('*')
            .eq('id', signerData.document_id)
            .single();
          
          if (docByNonce) {
            console.log('Document found by nonce fallback');
            // Continuar com este documento
          }
        }
      }
      
      return new Response(JSON.stringify({ error: 'Document not found', uuid: envelopeUuid, signerNonce }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Found document:', document.id, '- Name:', document.name);

    // Verificar se signatário completou assinatura
    // Formato novo: signer.signatureStatus === 'SIGNED'
    // Formato legado: event === 'SIGNER_COMPLETED' ou 'SIGNATURE_COMPLETED'
    const isSignerCompleted = signerStatus === 'SIGNED' || 
                              legacyEvent === 'SIGNER_COMPLETED' || 
                              legacyEvent === 'SIGNATURE_COMPLETED';

    if (isSignerCompleted) {
      console.log('=== SIGNER COMPLETED ===');
      
      // Atualizar status do signatário específico
      let query = supabase
        .from('document_signers')
        .update({
          status: 'signed',
          signed_at: new Date().toISOString(),
        })
        .eq('document_id', document.id);

      if (signerNonce) {
        query = query.eq('bry_signer_nonce', signerNonce);
        console.log('Updating signer by nonce:', signerNonce);
      } else if (signerEmail) {
        query = query.eq('email', signerEmail);
        console.log('Updating signer by email:', signerEmail);
      }

      const { error: signerError, data: updatedSigner } = await query.select();

      if (signerError) {
        console.error('Error updating signer status:', signerError);
      } else {
        console.log('Signer status updated to signed:', updatedSigner);
      }

      // Atualizar contagem de assinaturas no documento
      const { data: signedCount } = await supabase
        .from('document_signers')
        .select('id')
        .eq('document_id', document.id)
        .eq('status', 'signed');

      const newSignedBy = signedCount?.length || 0;

      const { error: updateError } = await supabase
        .from('documents')
        .update({ signed_by: newSignedBy })
        .eq('id', document.id);

      if (updateError) {
        console.error('Error updating signed_by:', updateError);
      } else {
        console.log('Document signed_by updated to:', newSignedBy);
      }
    }

    // Verificar se envelope foi completado (todas as assinaturas)
    // Formato novo: status === 'COMPLETED' ou 'SIGNED'
    // Formato legado: event === 'ENVELOPE_COMPLETED' ou 'SIGNATURE_ALL_COMPLETED'
    const isEnvelopeCompleted = envelopeStatus === 'COMPLETED' || 
                                envelopeStatus === 'SIGNED' ||
                                legacyEvent === 'ENVELOPE_COMPLETED' || 
                                legacyEvent === 'SIGNATURE_ALL_COMPLETED';

    if (isEnvelopeCompleted) {
      console.log('=== ENVELOPE COMPLETED ===');
      console.log('All signatures completed, downloading signed document');

      // Baixar documento assinado
      const docUuidForDownload = document.bry_document_uuid || documentUuid || '';
      console.log('Document UUID for download:', docUuidForDownload);
      
      const signedPdf = await downloadSignedDocument(envelopeUuid, docUuidForDownload);

      if (signedPdf) {
        // Fazer upload do documento assinado para o Storage
        const fileName = `${document.user_id}/${document.id}_signed.pdf`;
        
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(fileName, signedPdf, {
            contentType: 'application/pdf',
            upsert: true,
          });

        if (uploadError) {
          console.error('Error uploading signed document:', uploadError);
        } else {
          console.log('Signed document uploaded:', fileName);

          // Atualizar documento com URL do arquivo assinado
          await supabase
            .from('documents')
            .update({
              status: 'signed',
              bry_signed_file_url: fileName,
            })
            .eq('id', document.id);

          console.log('Document status updated to signed');
        }
      }

      // Marcar todos os signatários como assinados
      await supabase
        .from('document_signers')
        .update({
          status: 'signed',
          signed_at: new Date().toISOString(),
        })
        .eq('document_id', document.id)
        .eq('status', 'pending');

      // Atualizar contagem final
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

      console.log('Final signed_by count:', allSigners?.length || 0);

      // Enviar email de documento completado
      try {
        const { data: signers } = await supabase
          .from('document_signers')
          .select('email')
          .eq('document_id', document.id);

        if (signers && signers.length > 0) {
          const signerEmails = signers.map(s => s.email);
          
          await supabase.functions.invoke('send-document-completed-email', {
            body: {
              documentId: document.id,
              documentName: document.name,
              signerEmails,
              senderName: 'Eon Sign',
            },
          });
          console.log('Document completed email sent');
        }
      } catch (emailError) {
        console.error('Error sending completed email:', emailError);
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
