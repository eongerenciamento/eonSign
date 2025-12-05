import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { protocol } = await req.json();
    const BRY_ENVIRONMENT = Deno.env.get("BRY_ENVIRONMENT") || "homologation";

    if (!protocol) {
      throw new Error("Protocol is required");
    }

    console.log("Deleting certificate request:", protocol);

    const accessToken = await getToken();

    const baseUrl = BRY_ENVIRONMENT === "production"
      ? "https://ar-universal.bry.com.br"
      : "https://ar-universal.hom.bry.com.br";

    const response = await fetch(
      `${baseUrl}/api/certificate-requests/protocol/${protocol}`,
      {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Delete request response:", response.status);

    if (!response.ok) {
      const responseText = await response.text();
      let errorMessage = `Failed to delete request: ${response.status}`;
      
      try {
        const errorData = JSON.parse(responseText);
        if (response.status === 422) {
          errorMessage = "Status atual da solicitação não permite exclusão";
        } else if (response.status === 404) {
          errorMessage = "Solicitação não encontrada";
        } else {
          errorMessage = errorData.message || errorMessage;
        }
      } catch {
        // Use default error message
      }
      
      throw new Error(errorMessage);
    }

    // Also delete local record
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error: deleteError } = await supabase
      .from("certificate_requests")
      .delete()
      .eq("protocol", protocol);

    if (deleteError) {
      console.warn("Failed to delete local record:", deleteError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Solicitação excluída com sucesso",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Delete request error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
