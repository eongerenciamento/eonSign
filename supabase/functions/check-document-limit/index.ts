import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Lista completa de Price IDs válidos do eonSign
const ALL_EONSIGN_PRICE_IDS = [
  // Mensais
  "price_1SnWXYHRTD5WvpxjKl4TP1T8", // Start
  "price_1SnWXtHRTD5Wvpxjtgr5tWKJ", // Pro
  "price_1SnWY9HRTD5Wvpxjyw5KH0cX", // Empresarial I
  "price_1SnWYPHRTD5WvpxjyWw62Qe0", // Empresarial II
  "price_1SnWYfHRTD5Wvpxjo3b98A4o", // Ultra
  // Anuais
  "price_1SnWZ7HRTD5WvpxjuboSevS5", // Start
  "price_1SnWZOHRTD5Wvpxj8wRU9vHE", // Pro
  "price_1SnWZiHRTD5WvpxjVWZnxv0e", // Empresarial I
  "price_1SnWa4HRTD5WvpxjLSyivW7p", // Empresarial II
  "price_1SnWaTHRTD5WvpxjoAUEkP0P", // Ultra
];

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

    // Busca assinatura ativa do eonSign (verifica se price_id está na lista válida)
    const { data: subscription } = await supabaseClient
      .from("user_subscriptions")
      .select("plan_name, document_limit, status, stripe_price_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    // Se não tem assinatura ativa, não permite criar documentos
    if (!subscription) {
      logStep("No active subscription found");
      return new Response(JSON.stringify({
        canCreate: false,
        current: 0,
        limit: 0,
        planName: "Sem assinatura",
        remaining: 0,
        reason: "no_subscription"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Verifica se é uma assinatura válida do eonSign
    if (subscription.stripe_price_id && !ALL_EONSIGN_PRICE_IDS.includes(subscription.stripe_price_id)) {
      logStep("Subscription is not from eonSign", { priceId: subscription.stripe_price_id });
      return new Response(JSON.stringify({
        canCreate: false,
        current: 0,
        limit: 0,
        planName: "Assinatura inválida",
        remaining: 0,
        reason: "invalid_subscription"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const documentLimit = subscription.document_limit || 0;
    const planName = subscription.plan_name || "eonSign";
    logStep("User tier", { planName, documentLimit, priceId: subscription.stripe_price_id });

    // Plano Ultra tem documentos ilimitados (document_limit = -1)
    if (documentLimit === -1) {
      logStep("Unlimited plan detected");
      return new Response(JSON.stringify({
        canCreate: true,
        current: 0,
        limit: -1,
        planName,
        remaining: -1,
        unlimited: true
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

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
