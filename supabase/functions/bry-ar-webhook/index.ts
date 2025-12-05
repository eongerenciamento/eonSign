import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const webhookData = await req.json();
    console.log("BRy AR webhook received:", JSON.stringify(webhookData, null, 2));

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Extract protocol and status from webhook
    const protocol = webhookData.protocol;
    const status = webhookData.result || webhookData.status;

    if (!protocol) {
      console.log("No protocol in webhook data");
      return new Response(
        JSON.stringify({ code: 200, status: "success" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Updating certificate request ${protocol} to status: ${status}`);

    // Map BRy status to our status
    const statusMap: Record<string, string> = {
      received: "pending",
      in_validation: "in_validation",
      approved: "approved",
      validation_rejected: "validation_rejected",
      rejected: "rejected",
      issued: "issued",
      revoked: "revoked",
    };

    const mappedStatus = statusMap[status] || status;

    // First, get the certificate request to retrieve CPF for emission URL
    const { data: certRequest, error: fetchError } = await supabase
      .from("certificate_requests")
      .select("cpf, common_name")
      .eq("protocol", protocol)
      .single();

    if (fetchError) {
      console.error("Error fetching certificate request:", fetchError);
    }

    // Build update data
    const updateData: Record<string, any> = {
      status: mappedStatus,
      updated_at: new Date().toISOString(),
    };

    // Handle approved status - store emission URL
    if (status === "approved" && certRequest) {
      updateData.approved_at = new Date().toISOString();
      
      // Construct emission URL with CPF and protocol
      const cleanCpf = certRequest.cpf.replace(/\D/g, "");
      const bryEnvironment = Deno.env.get("BRY_ENVIRONMENT") || "hom";
      const baseUrl = bryEnvironment === "prod" 
        ? "https://mp-universal.bry.com.br"
        : "https://mp-universal.hom.bry.com.br";
      
      const emissionUrl = `${baseUrl}/protocolo/emissao?cpf=${cleanCpf}&protocolo=${protocol}`;
      updateData.emission_url = emissionUrl;
      
      console.log(`Generated emission URL for approved certificate: ${emissionUrl}`);
    }

    // Handle issued status - store certificate data if provided
    if (status === "issued") {
      updateData.issued_at = new Date().toISOString();
      updateData.certificate_issued = true;
      
      // Store PFX data if provided by webhook
      if (webhookData.pfx_data) {
        updateData.pfx_data = webhookData.pfx_data;
        console.log("Stored PFX data from webhook");
      }
      
      if (webhookData.pfx_password) {
        updateData.pfx_password = webhookData.pfx_password;
        console.log("Stored PFX password from webhook");
      }
      
      if (webhookData.certificate_serial) {
        updateData.certificate_serial = webhookData.certificate_serial;
      }
      
      if (webhookData.valid_from) {
        updateData.certificate_valid_from = webhookData.valid_from;
      }
      
      if (webhookData.valid_until) {
        updateData.certificate_valid_until = webhookData.valid_until;
      }
    }

    // Update the certificate request in database
    const { data, error } = await supabase
      .from("certificate_requests")
      .update(updateData)
      .eq("protocol", protocol)
      .select()
      .single();

    if (error) {
      console.error("Database update error:", error);
    } else {
      console.log("Certificate request updated:", data);
    }

    // Return success response as expected by BRy
    return new Response(
      JSON.stringify({ code: 200, status: "success" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Webhook processing error:", error);
    return new Response(
      JSON.stringify({ code: 500, status: "error", message: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
