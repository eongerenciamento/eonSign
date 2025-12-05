import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AttachDocumentRequest {
  protocol: string;
  document_type: string; // identity_document, address_proof, etc.
  document_name: string;
  document_base64: string;
  file_extension: string; // pdf, jpg, png
}

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
    const { protocol, document_type, document_name, document_base64, file_extension }: AttachDocumentRequest = await req.json();
    const BRY_ENVIRONMENT = Deno.env.get("BRY_ENVIRONMENT") || "homologation";

    if (!protocol || !document_type || !document_base64) {
      throw new Error("Missing required fields: protocol, document_type, document_base64");
    }

    console.log(`Attaching document to protocol ${protocol}, type: ${document_type}`);

    const accessToken = await getToken();

    const baseUrl = BRY_ENVIRONMENT === "production"
      ? "https://ar-universal.bry.com.br"
      : "https://ar-universal.hom.bry.com.br";

    // Valid document types
    const validTypes = [
      "identity_document",
      "address_proof",
      "voter_identity",
      "nis",
      "cpf",
      "constitutive_act",
      "election_minutes",
      "cnpj",
      "other",
      "cei",
      "revocation_term",
    ];

    if (!validTypes.includes(document_type)) {
      throw new Error(`Invalid document_type. Valid types: ${validTypes.join(", ")}`);
    }

    const requestBody = {
      type: document_type,
      name: document_name || `document.${file_extension || "pdf"}`,
      file: document_base64,
      extension: file_extension || "pdf",
    };

    const response = await fetch(
      `${baseUrl}/api/certificate-requests/protocol/${protocol}/documents`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    const responseText = await response.text();
    console.log("BRy attach document response:", response.status, responseText);

    if (!response.ok) {
      let errorMessage = `Attach document failed: ${response.status}`;
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch {}
      throw new Error(errorMessage);
    }

    const bryResponse = JSON.parse(responseText);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Document attached successfully",
        bry_response: bryResponse,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Attach document error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
