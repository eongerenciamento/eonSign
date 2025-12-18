import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_ADMIN_EMAIL = "marcus@mav.eng.br";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Authentication failed");
    
    if (userData.user.email !== SYSTEM_ADMIN_EMAIL) {
      throw new Error("Unauthorized: Not system admin");
    }

    console.log("[ADMIN-METRICS] Fetching system metrics...");

    // Get total users count
    const { count: totalUsers } = await supabaseClient
      .from("company_settings")
      .select("*", { count: "exact", head: true });

    // Get organizations count (same as company_settings)
    const organizations = totalUsers;

    // Get subscriptions by plan
    const { data: subscriptions } = await supabaseClient
      .from("user_subscriptions")
      .select("plan_name, status");

    const activeSubscriptions = subscriptions?.filter(s => s.status === "active") || [];
    const subscriptionsByPlan: Record<string, number> = {};
    activeSubscriptions.forEach(sub => {
      subscriptionsByPlan[sub.plan_name] = (subscriptionsByPlan[sub.plan_name] || 0) + 1;
    });

    // Get documents stats
    const { count: totalDocuments } = await supabaseClient
      .from("documents")
      .select("*", { count: "exact", head: true });

    const { count: signedDocuments } = await supabaseClient
      .from("documents")
      .select("*", { count: "exact", head: true })
      .eq("status", "signed");

    // Get tickets stats
    const { count: totalTickets } = await supabaseClient
      .from("support_tickets")
      .select("*", { count: "exact", head: true });

    const { count: openTickets } = await supabaseClient
      .from("support_tickets")
      .select("*", { count: "exact", head: true })
      .eq("status", "aberto");

    // Get Stripe revenue data
    let totalRevenue = 0;
    let monthlyRevenue = 0;
    try {
      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
        apiVersion: "2025-08-27.basil",
      });

      // Get balance
      const balance = await stripe.balance.retrieve();
      totalRevenue = balance.available.reduce((sum: number, b: { amount: number }) => sum + b.amount, 0) / 100;

      // Get this month's charges
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const charges = await stripe.charges.list({
        created: { gte: Math.floor(startOfMonth.getTime() / 1000) },
        limit: 100,
      });
      monthlyRevenue = charges.data
        .filter((c: { status: string }) => c.status === "succeeded")
        .reduce((sum: number, c: { amount: number }) => sum + c.amount, 0) / 100;
    } catch (stripeError) {
      console.error("[ADMIN-METRICS] Stripe error:", stripeError);
    }

    // Get monthly document usage stats
    const currentMonth = new Date().toISOString().slice(0, 7) + "-01";
    const { data: monthlyUsage } = await supabaseClient
      .from("monthly_document_usage")
      .select("document_count")
      .eq("month", currentMonth);

    const documentsThisMonth = monthlyUsage?.reduce((sum, u) => sum + u.document_count, 0) || 0;

    const metrics = {
      totalUsers: totalUsers || 0,
      organizations: organizations || 0,
      activeSubscriptions: activeSubscriptions.length,
      subscriptionsByPlan,
      totalDocuments: totalDocuments || 0,
      signedDocuments: signedDocuments || 0,
      documentsThisMonth,
      totalTickets: totalTickets || 0,
      openTickets: openTickets || 0,
      totalRevenue,
      monthlyRevenue,
    };

    console.log("[ADMIN-METRICS] Metrics fetched:", metrics);

    return new Response(JSON.stringify(metrics), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[ADMIN-METRICS] Error:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
