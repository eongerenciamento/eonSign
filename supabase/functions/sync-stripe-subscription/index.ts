import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mapeamento de price_ids para limites
const PRICE_ID_TO_PLAN: Record<string, { limit: number; name: string }> = {
  // Mensais
  "price_1SnWXYHRTD5WvpxjKl4TP1T8": { limit: 25, name: "Start" },
  "price_1SnWXtHRTD5Wvpxjtgr5tWKJ": { limit: 50, name: "Pro" },
  "price_1SnWY9HRTD5Wvpxjyw5KH0cX": { limit: 100, name: "Empresarial I" },
  "price_1SnWYPHRTD5WvpxjyWw62Qe0": { limit: 200, name: "Empresarial II" },
  "price_1SnWYfHRTD5Wvpxjo3b98A4o": { limit: 999999, name: "Ultra" },
  // Anuais
  "price_1SnWZ7HRTD5WvpxjuboSevS5": { limit: 25, name: "Start" },
  "price_1SnWZOHRTD5Wvpxj8wRU9vHE": { limit: 50, name: "Pro" },
  "price_1SnWZiHRTD5WvpxjVWZnxv0e": { limit: 100, name: "Empresarial I" },
  "price_1SnWa4HRTD5WvpxjLSyivW7p": { limit: 200, name: "Empresarial II" },
  "price_1SnWaTHRTD5WvpxjoAUEkP0P": { limit: 999999, name: "Ultra" },
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[SYNC-STRIPE-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { subscription_id, customer_id } = await req.json();
    logStep("Request received", { subscription_id, customer_id });

    if (!subscription_id && !customer_id) {
      throw new Error("subscription_id ou customer_id é obrigatório");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Buscar subscription do Stripe
    let subscription: Stripe.Subscription;
    if (subscription_id) {
      logStep("Fetching subscription by ID", { subscription_id });
      subscription = await stripe.subscriptions.retrieve(subscription_id);
    } else {
      logStep("Fetching active subscription for customer", { customer_id });
      const subs = await stripe.subscriptions.list({
        customer: customer_id,
        status: "active",
        limit: 1,
      });
      if (subs.data.length === 0) {
        throw new Error("Nenhuma assinatura ativa encontrada para este customer");
      }
      subscription = subs.data[0];
    }

    logStep("Subscription found", { 
      id: subscription.id, 
      status: subscription.status,
      customer: subscription.customer 
    });

    // Buscar customer do Stripe
    const customer = await stripe.customers.retrieve(
      subscription.customer as string
    ) as Stripe.Customer;

    if (!customer.email) {
      throw new Error("Customer sem email no Stripe");
    }

    logStep("Customer found", { 
      id: customer.id, 
      email: customer.email, 
      name: customer.name 
    });

    // Verificar se usuário já existe no Supabase Auth
    const { data: existingUsers } = await supabaseClient.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === customer.email?.toLowerCase()
    );

    logStep("Checked existing user", { 
      exists: !!existingUser, 
      userId: existingUser?.id 
    });

    // Verificar se subscription já existe
    const { data: existingSub } = await supabaseClient
      .from("user_subscriptions")
      .select("*")
      .eq("stripe_subscription_id", subscription.id)
      .single();

    logStep("Checked existing subscription", { exists: !!existingSub });

    if (existingUser && existingSub) {
      logStep("User and subscription already exist - nothing to do");
      return new Response(
        JSON.stringify({
          message: "Usuário e subscription já existem no sistema",
          user_id: existingUser.id,
          email: customer.email,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const priceId = subscription.items.data[0]?.price?.id;
    const plan = PRICE_ID_TO_PLAN[priceId] || { limit: 25, name: "Start" };
    const customerName = customer.name || customer.email.split("@")[0];

    logStep("Plan determined", { priceId, plan });

    let userId: string;
    let tempPassword: string | null = null;

    if (!existingUser) {
      // Criar novo usuário no Supabase Auth
      tempPassword = customer.email.split("@")[0] + Math.random().toString(36).slice(-4);

      logStep("Creating new user", { email: customer.email });

      const { data: newUser, error: createError } =
        await supabaseClient.auth.admin.createUser({
          email: customer.email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            name: customerName,
          },
        });

      if (createError) {
        logStep("Error creating user", { error: createError.message });
        throw createError;
      }

      userId = newUser.user.id;
      logStep("User created", { userId });

      // Criar company_settings
      const { error: companyError } = await supabaseClient
        .from("company_settings")
        .insert({
          user_id: userId,
          company_name: customerName,
          cnpj: "00.000.000/0000-00",
          admin_name: customerName,
          admin_cpf: "000.000.000-00",
          admin_phone: "(00)00000-0000",
          admin_email: customer.email,
        });

      if (companyError) {
        logStep("Error creating company_settings", { error: companyError.message });
        // Não é fatal, continua
      } else {
        logStep("Company settings created");
      }
    } else {
      userId = existingUser.id;
      logStep("Using existing user", { userId });
    }

    if (!existingSub) {
      // Criar user_subscription
      logStep("Creating user_subscription");

      // Safely convert timestamps
      const periodStart = subscription.current_period_start
        ? new Date(subscription.current_period_start * 1000).toISOString()
        : new Date().toISOString();
      const periodEnd = subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // Default 30 days

      const { error: subError } = await supabaseClient
        .from("user_subscriptions")
        .insert({
          user_id: userId,
          stripe_customer_id: customer.id,
          stripe_subscription_id: subscription.id,
          stripe_price_id: priceId,
          plan_name: plan.name,
          status: subscription.status,
          current_period_start: periodStart,
          current_period_end: periodEnd,
          cancel_at_period_end: subscription.cancel_at_period_end || false,
          document_limit: plan.limit,
        });

      if (subError) {
        logStep("Error creating subscription", { error: subError.message });
        throw subError;
      }

      logStep("User subscription created");
    }

    // Enviar email de boas-vindas se criou usuário novo
    if (tempPassword) {
      logStep("Sending welcome email", { email: customer.email });

      try {
        const emailResponse = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-welcome-email`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
            },
            body: JSON.stringify({
              email: customer.email,
              name: customerName,
              userId: userId,
              tempPassword: tempPassword,
              organizationName: customerName,
              tierName: plan.name,
            }),
          }
        );

        if (!emailResponse.ok) {
          const emailError = await emailResponse.text();
          logStep("Warning: Email send failed", { error: emailError });
        } else {
          logStep("Welcome email sent successfully");
        }
      } catch (emailErr) {
        logStep("Warning: Email send error", { error: String(emailErr) });
      }
    }

    const result = {
      success: true,
      user_id: userId,
      email: customer.email,
      name: customerName,
      plan: plan.name,
      document_limit: plan.limit,
      new_user_created: !!tempPassword,
      subscription_synced: !existingSub,
    };

    logStep("Sync completed successfully", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
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
