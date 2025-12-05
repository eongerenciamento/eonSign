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

    // Update the certificate request in database
    const updateData: Record<string, any> = {
      status: mappedStatus,
      updated_at: new Date().toISOString(),
    };

    if (status === "approved") {
      updateData.approved_at = new Date().toISOString();
    }

    if (status === "issued") {
      updateData.issued_at = new Date().toISOString();
      updateData.certificate_issued = true;
    }

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
