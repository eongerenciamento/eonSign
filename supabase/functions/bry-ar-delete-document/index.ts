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
    const { protocol, documentId } = await req.json();
    const BRY_ENVIRONMENT = Deno.env.get("BRY_ENVIRONMENT") || "homologation";

    if (!protocol || !documentId) {
      throw new Error("Protocol and documentId are required");
    }

    console.log("Deleting document:", { protocol, documentId });

    const accessToken = await getToken();

    const baseUrl = BRY_ENVIRONMENT === "production"
      ? "https://ar-universal.bry.com.br"
      : "https://ar-universal.hom.bry.com.br";

    const response = await fetch(
      `${baseUrl}/api/certificate-requests/protocol/${protocol}/documents/${documentId}`,
      {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Delete document response:", response.status);

    if (!response.ok) {
      const responseText = await response.text();
      let errorMessage = `Failed to delete document: ${response.status}`;
      
      try {
        const errorData = JSON.parse(responseText);
        if (response.status === 422) {
          errorMessage = "Status atual da solicitação não permite alteração";
        } else if (response.status === 404) {
          errorMessage = "Solicitação ou documento não encontrado";
        } else {
          errorMessage = errorData.message || errorMessage;
        }
      } catch {
        // Use default error message
      }
      
      throw new Error(errorMessage);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Documento excluído com sucesso",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Delete document error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
