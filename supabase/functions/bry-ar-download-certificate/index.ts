import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getAccessToken(): Promise<string> {
  const clientId = Deno.env.get("BRY_AR_CLIENT_ID");
  const clientSecret = Deno.env.get("BRY_AR_CLIENT_SECRET");
  const bryEnvironment = Deno.env.get("BRY_ENVIRONMENT") || "hom";
  
  const authUrl = bryEnvironment === "prod"
    ? "https://accounts.bry.com.br/auth/realms/BRyAR/protocol/openid-connect/token"
    : "https://accounts.hom.bry.com.br/auth/realms/BRyAR/protocol/openid-connect/token";

  console.log("[bry-ar-download-certificate] Getting access token from:", authUrl);

  const response = await fetch(authUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId!,
      client_secret: clientSecret!,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[bry-ar-download-certificate] Auth error:", errorText);
    throw new Error(`Failed to get access token: ${response.status}`);
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

    console.log("[bry-ar-download-certificate] Fetching certificate for protocol:", protocol);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // First check if we have the PFX stored in database
    const { data: certRequest, error: dbError } = await supabase
      .from("certificate_requests")
      .select("*")
      .eq("protocol", protocol)
      .single();

    if (dbError) {
      console.error("[bry-ar-download-certificate] Database error:", dbError);
      return new Response(
        JSON.stringify({ success: false, error: "Certificate request not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If we have PFX data stored, return it
    if (certRequest.pfx_data) {
      console.log("[bry-ar-download-certificate] Returning stored PFX data");
      return new Response(
        JSON.stringify({
          success: true,
          pfx_data: certRequest.pfx_data,
          pfx_password: certRequest.pfx_password,
          common_name: certRequest.common_name,
          certificate_serial: certRequest.certificate_serial,
          valid_from: certRequest.certificate_valid_from,
          valid_until: certRequest.certificate_valid_until,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If not stored, try to fetch from BRy API
    const bryEnvironment = Deno.env.get("BRY_ENVIRONMENT") || "hom";
    const baseUrl = bryEnvironment === "prod"
      ? "https://api.bry.com.br/ar"
      : "https://api.hom.bry.com.br/ar";

    const accessToken = await getAccessToken();

    // Try to download certificate from BRy
    const downloadUrl = `${baseUrl}/certificate-requests/${protocol}/certificate`;
    console.log("[bry-ar-download-certificate] Downloading from:", downloadUrl);

    const downloadResponse = await fetch(downloadUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json",
      },
    });

    if (!downloadResponse.ok) {
      const errorText = await downloadResponse.text();
      console.error("[bry-ar-download-certificate] Download error:", downloadResponse.status, errorText);
      
      // Certificate might not be ready yet
      if (downloadResponse.status === 404 || downloadResponse.status === 400) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Certificado ainda não está disponível para download. Aguarde a emissão ser concluída.",
            status: certRequest.status
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`Failed to download certificate: ${downloadResponse.status}`);
    }

    const certificateData = await downloadResponse.json();
    console.log("[bry-ar-download-certificate] Certificate data received");

    // Store the certificate data in database for future use
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (certificateData.pfx_data || certificateData.pfx) {
      updateData.pfx_data = certificateData.pfx_data || certificateData.pfx;
    }
    if (certificateData.password || certificateData.pfx_password) {
      updateData.pfx_password = certificateData.password || certificateData.pfx_password;
    }
    if (certificateData.serial || certificateData.certificate_serial) {
      updateData.certificate_serial = certificateData.serial || certificateData.certificate_serial;
    }
    if (certificateData.valid_from) {
      updateData.certificate_valid_from = certificateData.valid_from;
    }
    if (certificateData.valid_until) {
      updateData.certificate_valid_until = certificateData.valid_until;
    }

    // Update database with certificate data
    if (Object.keys(updateData).length > 1) {
      await supabase
        .from("certificate_requests")
        .update(updateData)
        .eq("protocol", protocol);
    }

    return new Response(
      JSON.stringify({
        success: true,
        pfx_data: certificateData.pfx_data || certificateData.pfx,
        pfx_password: certificateData.password || certificateData.pfx_password,
        common_name: certRequest.common_name,
        certificate_serial: certificateData.serial || certificateData.certificate_serial,
        valid_from: certificateData.valid_from,
        valid_until: certificateData.valid_until,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[bry-ar-download-certificate] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
