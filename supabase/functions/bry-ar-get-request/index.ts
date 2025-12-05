import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

  console.log("Authenticating with BRy AR for get-request...");

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

    console.log(`Fetching certificate request details for protocol: ${protocol}`);

    const accessToken = await getBryToken();
    const bryEnvironment = Deno.env.get("BRY_ENVIRONMENT") || "hom";
    const baseUrl = bryEnvironment === "prod"
      ? "https://ar-universal.bry.com.br"
      : "https://ar-universal.hom.bry.com.br";

    const response = await fetch(`${baseUrl}/api/certificate-requests/protocol/${protocol}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("BRy AR get request error:", errorText);
      
      if (response.status === 404) {
        return new Response(
          JSON.stringify({ success: false, error: "Solicitação não encontrada" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: `Erro ao buscar solicitação: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const requestData = await response.json();
    console.log("Certificate request details:", JSON.stringify(requestData, null, 2));

    // Optionally sync status to local database
    if (requestData.result) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const statusMap: Record<string, string> = {
        received: "pending",
        in_validation: "in_validation",
        approved: "approved",
        validation_rejected: "validation_rejected",
        rejected: "rejected",
        issued: "issued",
        revoked: "revoked",
      };

      const mappedStatus = statusMap[requestData.result] || requestData.result;

      const { error: updateError } = await supabase
        .from("certificate_requests")
        .update({ 
          status: mappedStatus,
          updated_at: new Date().toISOString()
        })
        .eq("protocol", protocol);

      if (updateError) {
        console.error("Error syncing status to database:", updateError);
      } else {
        console.log(`Synced status ${mappedStatus} to database for protocol ${protocol}`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        request: requestData,
        protocol: protocol
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in bry-ar-get-request:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
