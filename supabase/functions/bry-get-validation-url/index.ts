import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getToken(): Promise<string> {
  const clientId = Deno.env.get('BRY_CLIENT_ID');
  const clientSecret = Deno.env.get('BRY_CLIENT_SECRET');
  
  const tokenUrl = 'https://ar.syngularid.com.br/api/auth/applications';

  const tokenResponse = await fetch(tokenUrl, {
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

    console.log(`Getting validation URL for document: ${documentId}`);

    // Buscar documento
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
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

    const environment = Deno.env.get('BRY_ENVIRONMENT') || 'homologation';
    const apiBaseUrl = environment === 'production'
      ? 'https://easysign.bry.com.br'
      : 'https://easysign.hom.bry.com.br';

    // Se já temos o documentUuid, retornar URL diretamente
    if (document.bry_document_uuid) {
      const validationUrl = `${apiBaseUrl}/validate/${document.bry_document_uuid}`;
      console.log(`Validation URL: ${validationUrl}`);
      
      return new Response(JSON.stringify({ 
        validationUrl,
        documentUuid: document.bry_document_uuid,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar documentUuid do envelope
    const accessToken = await getToken();
    console.log('BRy token obtained, fetching envelope...');

    const envelopeUrl = `${apiBaseUrl}/api/service/sign/v1/signatures/${document.bry_envelope_uuid}`;
    
    const envelopeResponse = await fetch(envelopeUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!envelopeResponse.ok) {
      const errorText = await envelopeResponse.text();
      console.error('Failed to get envelope:', envelopeResponse.status, errorText);
      return new Response(JSON.stringify({ error: 'Failed to get envelope from BRy' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const envelopeData = await envelopeResponse.json();
    console.log('Envelope data:', JSON.stringify(envelopeData));

    const documentsList = envelopeData.documents || [];
    if (documentsList.length === 0) {
      return new Response(JSON.stringify({ error: 'No documents found in BRy envelope' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const documentUuid = documentsList[0].documentUuid || documentsList[0].uuid || documentsList[0].nonce;
    
    if (!documentUuid) {
      return new Response(JSON.stringify({ error: 'Could not determine document UUID' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Salvar para uso futuro
    await supabase
      .from('documents')
      .update({ bry_document_uuid: documentUuid })
      .eq('id', documentId);
    console.log(`Saved document UUID: ${documentUuid}`);

    const validationUrl = `${apiBaseUrl}/validate/${documentUuid}`;
    console.log(`Validation URL: ${validationUrl}`);

    return new Response(JSON.stringify({ 
      validationUrl,
      documentUuid,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in bry-get-validation-url:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

serve(handler);
