import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Token cache
let cachedToken: { token: string; expiresAt: number } | null = null;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const BRY_AR_CLIENT_ID = Deno.env.get("BRY_AR_CLIENT_ID");
    const BRY_AR_CLIENT_SECRET = Deno.env.get("BRY_AR_CLIENT_SECRET");
    const BRY_ENVIRONMENT = Deno.env.get("BRY_ENVIRONMENT") || "homologation";

    if (!BRY_AR_CLIENT_ID || !BRY_AR_CLIENT_SECRET) {
      throw new Error("BRy AR credentials not configured");
    }

    // Check if we have a valid cached token
    const now = Date.now();
    if (cachedToken && cachedToken.expiresAt > now + 60000) {
      console.log("Returning cached BRy AR token");
      return new Response(
        JSON.stringify({ access_token: cachedToken.token, cached: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get new token
    const baseUrl = BRY_ENVIRONMENT === "production"
      ? "https://ar-universal.bry.com.br"
      : "https://ar-universal.hom.bry.com.br";

    console.log("Requesting new BRy AR token from:", baseUrl);

    const tokenResponse = await fetch(`${baseUrl}/api/auth/applications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: BRY_AR_CLIENT_ID,
        client_secret: BRY_AR_CLIENT_SECRET,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("BRy AR auth error:", tokenResponse.status, errorText);
      throw new Error(`Failed to get BRy AR token: ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const expiresIn = tokenData.expires_in || 3600;

    // Cache the token
    cachedToken = {
      token: accessToken,
      expiresAt: now + expiresIn * 1000,
    };

    console.log("BRy AR token obtained successfully");

    return new Response(
      JSON.stringify({ access_token: accessToken, cached: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("BRy AR auth error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
