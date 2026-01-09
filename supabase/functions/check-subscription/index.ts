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
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
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
    if (!authHeader) {
      logStep("No authorization header");
      return new Response(JSON.stringify({ 
        hasAccess: false, 
        reason: "not_authenticated" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      logStep("Authentication error", { error: userError?.message });
      return new Response(JSON.stringify({ 
        hasAccess: false, 
        reason: "auth_error" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
    
    const user = userData.user;
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Busca assinatura ativa
    const { data: subscription, error: subError } = await supabaseClient
      .from("user_subscriptions")
      .select("id, plan_name, document_limit, status, stripe_price_id, stripe_subscription_id, current_period_end")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    logStep("Subscription query result", { subscription, error: subError?.message });

    // Verifica se tem assinatura ativa
    if (!subscription) {
      logStep("No active subscription found");
      return new Response(JSON.stringify({ 
        hasAccess: false, 
        reason: "no_subscription",
        message: "Nenhuma assinatura ativa encontrada"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Verifica se o price_id é do eonSign
    if (subscription.stripe_price_id && !ALL_EONSIGN_PRICE_IDS.includes(subscription.stripe_price_id)) {
      logStep("Subscription is not from eonSign", { 
        priceId: subscription.stripe_price_id
      });
      return new Response(JSON.stringify({ 
        hasAccess: false, 
        reason: "wrong_product",
        message: "Sua assinatura não é do eonSign. Assine um plano eonSign para acessar."
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Verifica se a assinatura não expirou
    if (subscription.current_period_end) {
      const periodEnd = new Date(subscription.current_period_end);
      if (periodEnd < new Date()) {
        logStep("Subscription expired", { periodEnd: subscription.current_period_end });
        return new Response(JSON.stringify({ 
          hasAccess: false, 
          reason: "subscription_expired",
          message: "Sua assinatura expirou. Renove para continuar acessando."
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    logStep("Access granted", { 
      planName: subscription.plan_name, 
      documentLimit: subscription.document_limit 
    });

    return new Response(JSON.stringify({
      hasAccess: true,
      planName: subscription.plan_name,
      documentLimit: subscription.document_limit,
      currentPeriodEnd: subscription.current_period_end
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ 
      hasAccess: false, 
      reason: "error",
      message: errorMessage 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
