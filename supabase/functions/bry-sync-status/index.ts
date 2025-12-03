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

interface SyncResult {
  documentId: string;
  success: boolean;
  changed: boolean;
  signedCount?: number;
  totalSigners?: number;
  completed?: boolean;
  error?: string;
}

async function syncSingleDocument(
  supabase: any,
  documentId: string,
  accessToken: string
): Promise<SyncResult> {
  try {
    // Buscar documento
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      return { documentId, success: false, changed: false, error: 'Document not found' };
    }

    if (!document.bry_envelope_uuid) {
      return { documentId, success: false, changed: false, error: 'No BRy envelope' };
    }

    const environment = Deno.env.get('BRY_ENVIRONMENT') || 'homologation';
    const apiBaseUrl = environment === 'production'
      ? 'https://easysign.bry.com.br'
      : 'https://easysign.hom.bry.com.br';

    // Tentar endpoint completo do envelope primeiro (retorna signers e documents)
    const envelopeUrl = `${apiBaseUrl}/api/service/sign/v1/signatures/${document.bry_envelope_uuid}`;
    console.log(`Fetching BRy envelope from: ${envelopeUrl}`);
    
    const envelopeResponse = await fetch(envelopeUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    
    let statusData: any = {};
    
    if (envelopeResponse.ok) {
      statusData = await envelopeResponse.json();
      console.log(`BRy envelope data for ${documentId}:`, JSON.stringify(statusData));
    } else {
      // Fallback para endpoint de status
      console.log('Envelope endpoint failed, trying status endpoint...');
      const statusUrl = `${apiBaseUrl}/api/service/sign/v1/signatures/${document.bry_envelope_uuid}/status`;
      
      const statusResponse = await fetch(statusUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!statusResponse.ok) {
        const errorText = await statusResponse.text();
        console.error(`Failed to get BRy status for ${documentId}:`, statusResponse.status, errorText);
        return { documentId, success: false, changed: false, error: 'Failed to get BRy status' };
      }

      statusData = await statusResponse.json();
      console.log(`BRy status for ${documentId}:`, JSON.stringify(statusData));
    }

    // Processar status dos signatários
    let signedCount = 0;
    let hasChanges = false;
    const previousSignedBy = document.signed_by || 0;
    
    // BRy pode retornar signers no nivel raiz ou dentro de documents
    const signersList = statusData.signers || statusData.subscribers || [];
    const documentsList = statusData.documents || [];
    
    // Log detalhado para debug
    console.log(`BRy signers count: ${signersList.length}, documents count: ${documentsList.length}`);
    
    // Extrair documentUuid se não temos
    if (!document.bry_document_uuid && documentsList.length > 0) {
      const docUuid = documentsList[0].documentUuid || documentsList[0].uuid;
      if (docUuid) {
        await supabase
          .from('documents')
          .update({ bry_document_uuid: docUuid })
          .eq('id', documentId);
        console.log(`Updated bry_document_uuid: ${docUuid}`);
      }
    }

    if (signersList.length > 0) {
      for (const brySigner of signersList) {
        const isCompleted = brySigner.status === 'COMPLETED' || brySigner.status === 'SIGNED';
        console.log(`BRy signer ${brySigner.email}: status=${brySigner.status}, isCompleted=${isCompleted}`);
        
        if (isCompleted) {
          signedCount++;

          // Atualizar signatário no banco
          const { data: updated } = await supabase
            .from('document_signers')
            .update({
              status: 'signed',
              signed_at: brySigner.signedAt || brySigner.completedAt || new Date().toISOString(),
            })
            .eq('document_id', documentId)
            .eq('email', brySigner.email)
            .eq('status', 'pending')
            .select();

          if (updated && updated.length > 0) {
            hasChanges = true;
            console.log(`Signer ${brySigner.email} marked as signed for ${documentId}`);
          }
        }
      }
    } else {
      // Se não há signers na resposta, buscar do banco para contar
      const { data: dbSigners } = await supabase
        .from('document_signers')
        .select('status')
        .eq('document_id', documentId);
      
      if (dbSigners) {
        signedCount = dbSigners.filter((s: { status: string }) => s.status === 'signed').length;
      }
    }

    // Verificar se contagem mudou
    if (signedCount !== previousSignedBy) {
      hasChanges = true;
    }

    // Verificar se todos assinaram
    const envelopeCompleted = statusData.status === 'COMPLETED' || statusData.status === 'SIGNED';
    const totalSigners = signersList.length || document.signers || 0;
    
    if (envelopeCompleted && document.status !== 'signed') {
      console.log(`All signatures completed for ${documentId}, downloading signed document`);
      hasChanges = true;

      // Obter document UUID se necessário
      let docUuid = document.bry_document_uuid;
      if (!docUuid && documentsList.length > 0) {
        docUuid = documentsList[0].documentUuid || documentsList[0].uuid;
      }

      if (docUuid) {
        // Baixar documento assinado
        const signedPdf = await downloadSignedDocument(
          document.bry_envelope_uuid,
          docUuid,
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
                bry_document_uuid: docUuid,
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
                const signerEmails = signers.map((s: { email: string }) => s.email);
                
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
        console.error('No document UUID available to download signed PDF');
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
      await supabase
        .from('documents')
        .update({ signed_by: signedCount })
        .eq('id', documentId);
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();
    
    // Support both single documentId and array of documentIds
    const documentIds: string[] = body.documentIds || (body.documentId ? [body.documentId] : []);

    if (documentIds.length === 0) {
      return new Response(JSON.stringify({ error: 'documentId or documentIds is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Syncing BRy status for ${documentIds.length} documents`);

    // Get BRy token once for all documents
    const accessToken = await getToken();
    console.log('BRy token obtained');

    // Process all documents
    const results: SyncResult[] = await Promise.all(
      documentIds.map((id) => syncSingleDocument(supabase, id, accessToken))
    );

    // For single document requests, return backward-compatible response
    if (body.documentId && !body.documentIds) {
      const result = results[0];
      return new Response(JSON.stringify({
        success: result.success,
        signedCount: result.signedCount,
        totalSigners: result.totalSigners,
        completed: result.completed,
        changed: result.changed,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // For multiple documents, return array of results
    return new Response(JSON.stringify({
      success: true,
      results,
      totalChanged: results.filter((r) => r.changed).length,
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