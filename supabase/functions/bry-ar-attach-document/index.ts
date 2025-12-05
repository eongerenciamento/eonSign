import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { decode as base64Decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

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

    // Remove data URL prefix if present (e.g., "data:image/jpeg;base64,")
    let cleanBase64 = document_base64;
    if (document_base64.includes(",")) {
      cleanBase64 = document_base64.split(",")[1];
    }

    // Decode base64 to binary
    const fileData = base64Decode(cleanBase64);
    
    // Determine MIME type
    const ext = (file_extension || "pdf").toLowerCase();
    const mimeTypes: Record<string, string> = {
      pdf: "application/pdf",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
    };
    const mimeType = mimeTypes[ext] || "application/octet-stream";
    
    const fileName = document_name || `document.${ext}`;

    // Create FormData for multipart upload
    const formData = new FormData();
    // Create a new ArrayBuffer and copy data for Blob compatibility
    const arrayBuffer = new ArrayBuffer(fileData.length);
    new Uint8Array(arrayBuffer).set(fileData);
    const blob = new Blob([arrayBuffer], { type: mimeType });
    formData.append("file", blob, fileName);
    formData.append("type", document_type);

    console.log(`Uploading file: ${fileName}, type: ${document_type}, size: ${fileData.length} bytes, mime: ${mimeType}`);

    const response = await fetch(
      `${baseUrl}/api/certificate-requests/protocol/${protocol}/documents`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          // Don't set Content-Type for FormData - browser/fetch will set it with boundary
        },
        body: formData,
      }
    );

    const responseText = await response.text();
    console.log("BRy attach document response:", response.status, responseText);

    if (!response.ok) {
      let errorMessage = `Attach document failed: ${response.status}`;
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.message || errorData.error || errorMessage;
        if (errorData.error_fields) {
          console.error("BRy validation errors:", JSON.stringify(errorData.error_fields));
        }
      } catch {}
      throw new Error(errorMessage);
    }

    let bryResponse = {};
    try {
      bryResponse = JSON.parse(responseText);
    } catch {
      bryResponse = { raw: responseText };
    }

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
