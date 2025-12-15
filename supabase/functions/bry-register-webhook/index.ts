import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getToken(): Promise<string> {
  const clientId = Deno.env.get('BRY_CLIENT_ID');
  const clientSecret = Deno.env.get('BRY_CLIENT_SECRET');
  
  const tokenUrl = 'https://ar.syngularid.com.br/api/auth/applications';

  console.log('Getting BRy token from:', tokenUrl);

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

  try {
    const accessToken = await getToken();
    console.log('BRy token obtained successfully');

    const environment = Deno.env.get('BRY_ENVIRONMENT') || 'homologation';
    const apiBaseUrl = environment === 'production'
      ? 'https://easysign.bry.com.br'
      : 'https://easysign.hom.bry.com.br';

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const webhookUrl = `${supabaseUrl}/functions/v1/bry-webhook`;

    console.log('Registering webhook URL:', webhookUrl);

    // Registrar webhook no BRy - webhookType deve ser "easy.signature"
    const webhookResponse = await fetch(`${apiBaseUrl}/api/service/sign/v1/webhook`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        urlEndpoint: webhookUrl,
        webhookType: 'easy.signature',
      }),
    });

    const responseText = await webhookResponse.text();
    console.log('BRy webhook registration response:', webhookResponse.status, responseText);

    const results = [{
      type: 'easy.signature',
      status: webhookResponse.status,
      response: responseText
    }];

    // Listar webhooks existentes para verificar
    console.log('Listing existing webhooks...');
    const listResponse = await fetch(`${apiBaseUrl}/api/service/sign/v1/webhook`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    const listText = await listResponse.text();
    console.log('Existing webhooks:', listResponse.status, listText);

    // Verificar se algum registro falhou
    const failedRegistrations = results.filter(r => r.status >= 400);
    
    if (failedRegistrations.length === results.length) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'All webhook registrations failed',
        results,
        existingWebhooks: listText
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Webhooks registered',
      webhookUrl,
      results,
      existingWebhooks: listText
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in bry-register-webhook:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

serve(handler);
