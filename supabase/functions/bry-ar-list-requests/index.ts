import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getToken(): Promise<string> {
  const BRY_AR_CLIENT_ID = Deno.env.get("BRY_AR_CLIENT_ID");
  const BRY_AR_CLIENT_SECRET = Deno.env.get("BRY_AR_CLIENT_SECRET");
  const BRY_ENVIRONMENT = Deno.env.get("BRY_ENVIRONMENT") || "homologation";

  const baseUrl = BRY_ENVIRONMENT === "production"
    ? "https://ar-universal.bry.com.br"
    : "https://ar-universal.hom.bry.com.br";

  const response = await fetch(`${baseUrl}/api/auth/applications`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: BRY_AR_CLIENT_ID,
      client_secret: BRY_AR_CLIENT_SECRET,
    }),
  });

  if (!response.ok) {
    throw new Error(`Auth failed: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { cpf, protocol, status } = await req.json();
    const BRY_ENVIRONMENT = Deno.env.get("BRY_ENVIRONMENT") || "homologation";

    console.log("Listing certificate requests:", { cpf, protocol, status });

    const accessToken = await getToken();

    const baseUrl = BRY_ENVIRONMENT === "production"
      ? "https://ar-universal.bry.com.br"
      : "https://ar-universal.hom.bry.com.br";

    // Build query params
    const params = new URLSearchParams();
    if (cpf) params.append("cpf", cpf.replace(/\D/g, ""));
    if (protocol) params.append("protocol", protocol);
    if (status) {
      if (Array.isArray(status)) {
        status.forEach((s: string) => params.append("result[]", s));
      } else {
        params.append("result[]", status);
      }
    }
    params.append("sort", "created_at");
    params.append("direction", "desc");

    const url = `${baseUrl}/api/certificate-requests?${params.toString()}`;
    console.log("Fetching from:", url);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    const responseText = await response.text();
    console.log("List requests response:", response.status);

    if (!response.ok) {
      throw new Error(`List requests failed: ${response.status}`);
    }

    const requests = JSON.parse(responseText);

    return new Response(
      JSON.stringify({
        success: true,
        requests: requests,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("List requests error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
