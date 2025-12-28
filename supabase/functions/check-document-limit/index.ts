import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Price ID específico do eonSign
const EONSIGN_PRICE_ID = "price_1SWhQIHRTD5WvpxjPvRHBY18";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-LIMIT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Busca assinatura ativa do eonSign especificamente (verifica price_id)
    const { data: subscription } = await supabaseClient
      .from("user_subscriptions")
      .select("plan_name, document_limit, status, stripe_price_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .eq("stripe_price_id", EONSIGN_PRICE_ID) // Só considera assinaturas do eonSign
      .single();

    // Se não tem assinatura do eonSign, não permite criar documentos
    if (!subscription) {
      logStep("No valid eonSign subscription found");
      return new Response(JSON.stringify({
        canCreate: false,
        current: 0,
        limit: 0,
        planName: "Sem assinatura eonSign",
        remaining: 0,
        reason: "no_eonsign_subscription"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const documentLimit = subscription.document_limit || 0;
    const planName = subscription.plan_name || "eonSign";
    logStep("User tier", { planName, documentLimit, priceId: subscription.stripe_price_id });

    // Get current month usage
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);
    const monthStr = currentMonth.toISOString().split('T')[0];

    const { data: usage } = await supabaseClient
      .from("monthly_document_usage")
      .select("document_count")
      .eq("user_id", user.id)
      .eq("month", monthStr)
      .single();

    const currentCount = usage?.document_count || 0;
    const canCreate = currentCount < documentLimit;

    logStep("Usage checked", { currentCount, documentLimit, canCreate });

    return new Response(JSON.stringify({
      canCreate,
      current: currentCount,
      limit: documentLimit,
      planName,
      remaining: Math.max(0, documentLimit - currentCount)
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
