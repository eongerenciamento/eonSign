import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WEBHOOK_URL = "https://beyefodsuuftviwthdfe.supabase.co/functions/v1/user-webhook";

interface WebhookPayload {
  event: "user.created" | "user.updated" | "user.deleted";
  system_name: "eonsign";
  user: {
    external_id: string;
    name?: string;
    email: string;
    role?: string;
    organization_stripe_id?: string;
  };
}

export async function sendMemberWebhook(payload: WebhookPayload): Promise<{ success: boolean; error?: string }> {
  const apiKey = Deno.env.get("EONSIGN_WEBHOOK_API_KEY");
  
  if (!apiKey) {
    console.error("[MEMBER-WEBHOOK] API key not configured");
    return { success: false, error: "API key not configured" };
  }

  try {
    console.log("[MEMBER-WEBHOOK] Sending webhook:", JSON.stringify(payload));
    
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[MEMBER-WEBHOOK] Webhook failed:", response.status, errorText);
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    console.log("[MEMBER-WEBHOOK] Webhook sent successfully");
    return { success: true };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[MEMBER-WEBHOOK] Error sending webhook:", error);
    return { success: false, error: errorMessage };
  }
}

// HTTP handler for direct calls
const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: WebhookPayload = await req.json();
    
    if (!payload.event || !payload.user?.email) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await sendMemberWebhook(payload);
    
    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[MEMBER-WEBHOOK] Handler error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
