import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cache do token em memória
let cachedToken: { token: string; expiresAt: number } | null = null;

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const clientId = Deno.env.get('BRY_CLIENT_ID');
    const clientSecret = Deno.env.get('BRY_CLIENT_SECRET');
    const environment = Deno.env.get('BRY_ENVIRONMENT') || 'homologation';
    
    if (!clientId || !clientSecret) {
      console.error('BRy credentials not configured');
      throw new Error('BRy credentials not configured');
    }

    // Verificar se temos token em cache válido (com margem de 30 segundos)
    const now = Date.now();
    if (cachedToken && cachedToken.expiresAt > now + 30000) {
      console.log('Returning cached BRy token');
      return new Response(JSON.stringify({ 
        access_token: cachedToken.token,
        from_cache: true 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tokenUrl = 'https://ar.syngularid.com.br/api/auth/applications';

    console.log(`Requesting new BRy token from ${tokenUrl}`);

    // Fazer requisição para obter novo token
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('BRy token request failed:', tokenResponse.status, errorText);
      throw new Error(`Failed to get BRy token: ${tokenResponse.status} - ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    console.log('BRy token obtained successfully, expires_in:', tokenData.expires_in);

    // Cachear o token
    cachedToken = {
      token: tokenData.access_token,
      expiresAt: now + (tokenData.expires_in * 1000),
    };

    return new Response(JSON.stringify({ 
      access_token: tokenData.access_token,
      expires_in: tokenData.expires_in,
      from_cache: false 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in bry-get-token:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

serve(handler);
