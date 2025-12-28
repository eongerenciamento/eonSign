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

    // Busca assinatura ativa do eonSign especificamente
    const { data: subscription, error: subError } = await supabaseClient
      .from("user_subscriptions")
      .select("id, plan_name, document_limit, status, stripe_price_id, stripe_subscription_id, current_period_end")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    logStep("Subscription query result", { subscription, error: subError?.message });

    // Verifica se tem assinatura ativa E se é do eonSign (price_id correto)
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
    if (subscription.stripe_price_id !== EONSIGN_PRICE_ID) {
      logStep("Subscription is not from eonSign", { 
        priceId: subscription.stripe_price_id, 
        expected: EONSIGN_PRICE_ID 
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
