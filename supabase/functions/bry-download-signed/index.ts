import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DownloadRequest {
  documentId: string;
}

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
    throw new Error('Failed to get BRy token');
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

async function getDocumentUuidFromStatus(envelopeUuid: string, accessToken: string, apiBaseUrl: string): Promise<string | null> {
  try {
    const statusUrl = `${apiBaseUrl}/api/service/sign/v1/signatures/${envelopeUuid}/status`;
    console.log('Fetching document UUID from status:', statusUrl);
    
    const statusResponse = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!statusResponse.ok) {
      console.error('Failed to get status:', statusResponse.status);
      return null;
    }

    const statusData = await statusResponse.json();
    console.log('Status response documents:', JSON.stringify(statusData.documents));
    
    // BRy pode retornar documentUuid ou uuid
    const docUuid = statusData.documents?.[0]?.documentUuid || statusData.documents?.[0]?.uuid;
    return docUuid || null;
  } catch (error) {
    console.error('Error getting document UUID from status:', error);
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
    const { documentId }: DownloadRequest = await req.json();

    console.log('Downloading signed document for:', documentId);

    // Buscar documento
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      throw new Error('Document not found');
    }

    if (!document.bry_envelope_uuid) {
      throw new Error('Document does not have BRy envelope UUID');
    }

    // Obter token da BRy
    const accessToken = await getToken();

    const environment = Deno.env.get('BRY_ENVIRONMENT') || 'homologation';
    const apiBaseUrl = environment === 'production'
      ? 'https://easysign.bry.com.br'
      : 'https://easysign.hom.bry.com.br';

    // Se não temos o document UUID, tentar obter via status
    let documentUuid = document.bry_document_uuid;
    if (!documentUuid) {
      console.log('Document UUID not found in database, fetching from BRy status...');
      documentUuid = await getDocumentUuidFromStatus(document.bry_envelope_uuid, accessToken, apiBaseUrl);
      
      if (documentUuid) {
        // Salvar o UUID para futuras requisições
        await supabase
          .from('documents')
          .update({ bry_document_uuid: documentUuid })
          .eq('id', documentId);
        console.log('Document UUID saved:', documentUuid);
      }
    }

    if (!documentUuid) {
      throw new Error('Could not obtain document UUID from BRy');
    }

    // Baixar documento assinado
    const downloadUrl = `${apiBaseUrl}/api/service/sign/v1/signatures/${document.bry_envelope_uuid}/documents/${documentUuid}/signed`;
    console.log('Downloading from:', downloadUrl);

    const downloadResponse = await fetch(downloadUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!downloadResponse.ok) {
      const errorText = await downloadResponse.text();
      throw new Error(`Failed to download: ${downloadResponse.status} - ${errorText}`);
    }

    const signedPdf = await downloadResponse.arrayBuffer();
    console.log('Downloaded signed PDF, size:', signedPdf.byteLength);

    // Fazer upload para o Storage
    const fileName = `${document.user_id}/${document.id}_signed.pdf`;
    
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, signedPdf, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Failed to upload signed document: ${uploadError.message}`);
    }

    console.log('Signed document uploaded to:', fileName);

    // Atualizar documento com URL do arquivo assinado
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        bry_signed_file_url: fileName,
        status: 'signed',
      })
      .eq('id', documentId);

    if (updateError) {
      console.error('Error updating document:', updateError);
    }

    // Gerar URL assinada para download imediato
    const { data: signedUrlData } = await supabase.storage
      .from('documents')
      .createSignedUrl(fileName, 3600);

    return new Response(JSON.stringify({
      success: true,
      signedFileUrl: fileName,
      downloadUrl: signedUrlData?.signedUrl || null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in bry-download-signed:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

serve(handler);
