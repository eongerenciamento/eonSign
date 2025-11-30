import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-FREE-ACCOUNT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const { email, organizationName } = await req.json();
    if (!email || !organizationName) {
      throw new Error("Missing required fields: email, organizationName");
    }
    logStep("Request data", { email, organizationName });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Check if user already exists
    const { data: existingUsers } = await supabaseClient.auth.admin.listUsers();
    const userExists = existingUsers?.users.find(u => u.email === email);
    
    if (userExists) {
      throw new Error("Este email já está cadastrado");
    }

    // Generate temporary password
    const tempPassword = email.split('@')[0] + Math.random().toString(36).slice(-4);
    logStep("Generated temp password");

    // Create user
    const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    });

    if (createError) {
      logStep("Error creating user", { error: createError.message });
      throw createError;
    }

    logStep("User created", { userId: newUser.user.id });

    // Create company_settings
    await supabaseClient.from("company_settings").insert({
      user_id: newUser.user.id,
      company_name: organizationName,
      cnpj: "00.000.000/0000-00",
      admin_name: organizationName,
      admin_cpf: "000.000.000-00",
      admin_phone: "(00)00000-0000",
      admin_email: email,
    });

    logStep("Company settings created");

    // Create free subscription (no Stripe customer needed)
    await supabaseClient.from("user_subscriptions").insert({
      user_id: newUser.user.id,
      stripe_customer_id: "free_tier",
      plan_name: "Gratuito",
      status: "active",
      document_limit: 5,
    });

    logStep("Free subscription created");

    // Send welcome email with temporary password
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-welcome-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
      },
      body: JSON.stringify({
        email,
        name: organizationName,
        userId: newUser.user.id,
        tempPassword,
      }),
    });

    logStep("Welcome email sent");

    return new Response(JSON.stringify({ success: true }), {
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
