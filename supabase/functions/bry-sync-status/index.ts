import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getToken(): Promise<string> {
  const clientId = Deno.env.get('BRY_CLIENT_ID');
  const clientSecret = Deno.env.get('BRY_CLIENT_SECRET');
  const environment = Deno.env.get('BRY_ENVIRONMENT') || 'homologation';
  
  const baseUrl = environment === 'production' 
    ? 'https://cloud.bry.com.br'
    : 'https://cloud-hom.bry.com.br';

  const tokenResponse = await fetch(`${baseUrl}/token-service/jwt`, {
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
    const errorText = await tokenResponse.text();
    throw new Error(`Failed to get BRy token: ${tokenResponse.status} - ${errorText}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

async function downloadSignedDocument(envelopeUuid: string, documentUuid: string, accessToken: string): Promise<ArrayBuffer | null> {
  try {
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

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { documentId } = await req.json();

    if (!documentId) {
      return new Response(JSON.stringify({ error: 'documentId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Syncing BRy status for document:', documentId);

    // Buscar documento
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      console.error('Document not found:', docError);
      return new Response(JSON.stringify({ error: 'Document not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!document.bry_envelope_uuid) {
      return new Response(JSON.stringify({ error: 'Document does not have BRy envelope' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accessToken = await getToken();
    console.log('BRy token obtained');

    const environment = Deno.env.get('BRY_ENVIRONMENT') || 'homologation';
    const apiBaseUrl = environment === 'production'
      ? 'https://easysign.bry.com.br'
      : 'https://easysign.hom.bry.com.br';

    // Consultar status do envelope no BRy
    const statusUrl = `${apiBaseUrl}/api/service/sign/v1/signatures/${document.bry_envelope_uuid}/status`;
    console.log('Fetching status from:', statusUrl);

    const statusResponse = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      console.error('Failed to get BRy status:', statusResponse.status, errorText);
      return new Response(JSON.stringify({ 
        error: 'Failed to get BRy status',
        details: errorText 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const statusData = await statusResponse.json();
    console.log('BRy status response:', JSON.stringify(statusData));

    // Processar status dos signatários
    let signedCount = 0;
    const signerUpdates: { email: string; status: string; signed_at: string | null }[] = [];

    if (statusData.signers) {
      for (const brySigner of statusData.signers) {
        const isCompleted = brySigner.status === 'COMPLETED' || brySigner.status === 'SIGNED';
        
        if (isCompleted) {
          signedCount++;
          signerUpdates.push({
            email: brySigner.email,
            status: 'signed',
            signed_at: brySigner.signedAt || new Date().toISOString(),
          });

          // Atualizar signatário no banco
          await supabase
            .from('document_signers')
            .update({
              status: 'signed',
              signed_at: brySigner.signedAt || new Date().toISOString(),
            })
            .eq('document_id', documentId)
            .eq('email', brySigner.email);

          console.log(`Signer ${brySigner.email} marked as signed`);
        }
      }
    }

    // Verificar se todos assinaram
    const envelopeCompleted = statusData.status === 'COMPLETED' || statusData.status === 'SIGNED';
    
    if (envelopeCompleted) {
      console.log('All signatures completed, downloading signed document');

      // Baixar documento assinado
      const signedPdf = await downloadSignedDocument(
        document.bry_envelope_uuid,
        document.bry_document_uuid || '',
        accessToken
      );

      if (signedPdf) {
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

          // Atualizar documento
          await supabase
            .from('documents')
            .update({
              status: 'signed',
              bry_signed_file_url: fileName,
              signed_by: signedCount,
            })
            .eq('id', documentId);

          console.log('Document status updated to signed');

          // Enviar email de conclusão
          try {
            const { data: signers } = await supabase
              .from('document_signers')
              .select('email')
              .eq('document_id', documentId);

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
      }
    } else {
      // Atualizar apenas contagem de assinaturas
      await supabase
        .from('documents')
        .update({ signed_by: signedCount })
        .eq('id', documentId);
    }

    return new Response(JSON.stringify({
      success: true,
      bryStatus: statusData.status,
      signedCount,
      totalSigners: statusData.signers?.length || 0,
      completed: envelopeCompleted,
      signerUpdates,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in bry-sync-status:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

serve(handler);
