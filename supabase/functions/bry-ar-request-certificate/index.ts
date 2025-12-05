import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CertificateRequestPF {
  type: "PF";
  common_name: string;
  cpf: string;
  email: string;
  phone: string;
  holder_birthdate: string;
  user_id?: string;
  signer_id?: string;
  document_id?: string;
}

interface CertificateRequestPJ {
  type: "PJ";
  common_name: string;
  cpf: string;
  email: string;
  phone: string;
  holder_birthdate: string;
  responsible_name: string;
  cnpj: string;
  user_id?: string;
  signer_id?: string;
  document_id?: string;
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
    const requestData: CertificateRequestPF | CertificateRequestPJ = await req.json();
    const BRY_ENVIRONMENT = Deno.env.get("BRY_ENVIRONMENT") || "homologation";

    console.log("Certificate request received:", JSON.stringify(requestData, null, 2));

    // Get auth token
    const accessToken = await getToken();

    // Build request body
    const baseUrl = BRY_ENVIRONMENT === "production"
      ? "https://ar-universal.bry.com.br"
      : "https://ar-universal.hom.bry.com.br";

    // Product IDs: 106 for PF, 107 for PJ
    const productId = requestData.type === "PJ" ? 107 : 106;

    // Format phone (remove all non-numeric)
    const phone = requestData.phone.replace(/\D/g, "");
    
    // Format birth date (remove all non-numeric)
    const birthDate = requestData.holder_birthdate.replace(/\D/g, "");

    // Remove accents from common_name
    const commonName = requestData.common_name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    const certRequestBody: Record<string, any> = {
      common_name: commonName,
      cpf: requestData.cpf.replace(/\D/g, ""),
      email: requestData.email,
      phone: phone,
      holder_birthdate: birthDate,
      product_id: productId,
      registration_authority_id: 61,
      registry_office_id: 658,
    };

    // Add PJ specific fields
    if (requestData.type === "PJ") {
      const pjData = requestData as CertificateRequestPJ;
      certRequestBody.cnpj = pjData.cnpj.replace(/\D/g, "");
      certRequestBody.responsible_name = pjData.responsible_name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    }

    console.log("Sending certificate request to BRy:", JSON.stringify(certRequestBody, null, 2));

    const response = await fetch(`${baseUrl}/api/certificate-requests`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(certRequestBody),
    });

    const responseText = await response.text();
    console.log("BRy response status:", response.status);
    console.log("BRy response:", responseText);

    if (!response.ok) {
      let errorMessage = `Request failed: ${response.status}`;
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch {}
      throw new Error(errorMessage);
    }

    const bryResponse = JSON.parse(responseText);
    const protocol = bryResponse.protocol;

    console.log("Certificate request created with protocol:", protocol);

    // Save to database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const dbRecord: Record<string, any> = {
      protocol: protocol,
      type: requestData.type,
      status: "pending",
      common_name: requestData.common_name,
      cpf: requestData.cpf,
      email: requestData.email,
      phone: requestData.phone,
      birth_date: requestData.holder_birthdate,
      product_id: productId,
      registration_authority_id: 61,
      registry_office_id: 658,
    };

    if (requestData.user_id) {
      dbRecord.user_id = requestData.user_id;
    }
    if (requestData.signer_id) {
      dbRecord.signer_id = requestData.signer_id;
    }
    if (requestData.document_id) {
      dbRecord.document_id = requestData.document_id;
    }
    if (requestData.type === "PJ") {
      const pjData = requestData as CertificateRequestPJ;
      dbRecord.cnpj = pjData.cnpj;
      dbRecord.responsible_name = pjData.responsible_name;
    }

    const { data: dbData, error: dbError } = await supabase
      .from("certificate_requests")
      .insert(dbRecord)
      .select()
      .single();

    if (dbError) {
      console.error("Database error:", dbError);
      // Don't throw - the BRy request succeeded
    }

    return new Response(
      JSON.stringify({
        success: true,
        protocol: protocol,
        certificate_request_id: dbData?.id,
        bry_response: bryResponse,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Certificate request error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
