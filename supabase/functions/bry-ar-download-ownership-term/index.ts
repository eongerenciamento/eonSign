import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getBryToken(): Promise<string> {
  const clientId = Deno.env.get("BRY_AR_CLIENT_ID");
  const clientSecret = Deno.env.get("BRY_AR_CLIENT_SECRET");
  const bryEnvironment = Deno.env.get("BRY_ENVIRONMENT") || "hom";
  
  const authUrl = bryEnvironment === "prod"
    ? "https://ar-universal.bry.com.br/api/auth"
    : "https://ar-universal.hom.bry.com.br/api/auth";

  console.log("Authenticating with BRy AR for ownership term download...");

  const response = await fetch(authUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("BRy AR auth error:", errorText);
    throw new Error(`BRy AR authentication failed: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { protocol } = await req.json();

    if (!protocol) {
      return new Response(
        JSON.stringify({ success: false, error: "Protocol is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Downloading ownership term for protocol: ${protocol}`);

    const accessToken = await getBryToken();
    const bryEnvironment = Deno.env.get("BRY_ENVIRONMENT") || "hom";
    const baseUrl = bryEnvironment === "prod"
      ? "https://ar-universal.bry.com.br"
      : "https://ar-universal.hom.bry.com.br";

    const response = await fetch(`${baseUrl}/api/certificate-requests/${protocol}/ownership-term`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/pdf",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("BRy AR download ownership term error:", errorText);
      
      if (response.status === 404) {
        return new Response(
          JSON.stringify({ success: false, error: "Termo de titularidade não encontrado" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: `Erro ao baixar termo: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the PDF content
    const pdfBuffer = await response.arrayBuffer();
    const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));

    console.log(`Successfully downloaded ownership term for protocol: ${protocol}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        pdf_data: pdfBase64,
        filename: `termo_titularidade_${protocol}.pdf`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in bry-ar-download-ownership-term:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
