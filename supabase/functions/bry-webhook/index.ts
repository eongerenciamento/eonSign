import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BryWebhookPayload {
  event: string;
  uuid: string;
  signerNonce?: string;
  signerEmail?: string;
  documentUuid?: string;
  timestamp?: string;
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const payload: BryWebhookPayload = await req.json();
    console.log('BRy webhook received:', JSON.stringify(payload));

    const { event, uuid, signerNonce, signerEmail, documentUuid } = payload;

    // Buscar documento pelo envelope UUID
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('bry_envelope_uuid', uuid)
      .maybeSingle();

    if (docError || !document) {
      console.error('Document not found for envelope UUID:', uuid);
      return new Response(JSON.stringify({ error: 'Document not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Found document:', document.id);

    if (event === 'SIGNER_COMPLETED' || event === 'SIGNATURE_COMPLETED') {
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
      } else if (signerEmail) {
        query = query.eq('email', signerEmail);
      }

      const { error: signerError } = await query;

      if (signerError) {
        console.error('Error updating signer status:', signerError);
      } else {
        console.log('Signer status updated to signed');
      }

      // Atualizar contagem de assinaturas no documento
      const { data: signedCount } = await supabase
        .from('document_signers')
        .select('id')
        .eq('document_id', document.id)
        .eq('status', 'signed');

      const newSignedBy = signedCount?.length || 0;

      await supabase
        .from('documents')
        .update({ signed_by: newSignedBy })
        .eq('id', document.id);

      console.log('Document signed_by updated to:', newSignedBy);
    }

    if (event === 'ENVELOPE_COMPLETED' || event === 'SIGNATURE_ALL_COMPLETED') {
      console.log('All signatures completed, downloading signed document');

      // Baixar documento assinado
      const signedPdf = await downloadSignedDocument(uuid, document.bry_document_uuid || documentUuid || '');

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
          const { data: { publicUrl } } = supabase.storage
            .from('documents')
            .getPublicUrl(fileName);

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
