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

    console.log(`Downloading BRy report for document: ${documentId}`);

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

    // Obter token BRy
    const accessToken = await getToken();
    console.log('BRy token obtained');

    const environment = Deno.env.get('BRY_ENVIRONMENT') || 'homologation';
    const apiBaseUrl = environment === 'production'
      ? 'https://easysign.bry.com.br'
      : 'https://easysign.hom.bry.com.br';

    // Se não temos o documentUuid/nonce, buscar do envelope
    let documentNonce = document.bry_document_uuid;
    
    if (!documentNonce) {
      console.log('Fetching document nonce from BRy envelope...');
      const envelopeUrl = `${apiBaseUrl}/api/service/sign/v1/signatures/${document.bry_envelope_uuid}`;
      
      const envelopeResponse = await fetch(envelopeUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (envelopeResponse.ok) {
        const envelopeData = await envelopeResponse.json();
        console.log('Envelope data:', JSON.stringify(envelopeData));
        
        const documentsList = envelopeData.documents || [];
        if (documentsList.length > 0) {
          // Pode ser documentUuid, uuid, ou nonce dependendo da versão da API
          documentNonce = documentsList[0].nonce || documentsList[0].documentUuid || documentsList[0].uuid;
          
          // Salvar para uso futuro
          if (documentNonce) {
            await supabase
              .from('documents')
              .update({ bry_document_uuid: documentNonce })
              .eq('id', documentId);
            console.log(`Saved document nonce: ${documentNonce}`);
          }
        }
      }
    }

    if (!documentNonce) {
      return new Response(JSON.stringify({ error: 'Could not determine document nonce for report' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Baixar relatório unificado
    const reportUrl = `${apiBaseUrl}/api/service/sign/v1/signatures/${document.bry_envelope_uuid}/documents/${documentNonce}/reportUnified`;
    console.log(`Downloading report from: ${reportUrl}`);

    const reportResponse = await fetch(reportUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!reportResponse.ok) {
      const errorText = await reportResponse.text();
      console.error('Failed to download report:', reportResponse.status, errorText);
      return new Response(JSON.stringify({ 
        error: 'Failed to download report from BRy',
        details: errorText 
      }), {
        status: reportResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Retornar PDF diretamente
    const pdfBuffer = await reportResponse.arrayBuffer();
    console.log(`Report downloaded, size: ${pdfBuffer.byteLength} bytes`);

    return new Response(pdfBuffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${document.name}_evidencias.pdf"`,
      },
    });

  } catch (error: any) {
    console.error('Error in bry-download-report:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

serve(handler);
