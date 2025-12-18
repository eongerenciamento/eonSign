import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

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

    console.log("[ADMIN-TICKETS] Fetching all tickets...");

    // Get all tickets with user info
    const { data: tickets, error: ticketsError } = await supabaseClient
      .from("support_tickets")
      .select("*")
      .order("created_at", { ascending: false });

    if (ticketsError) throw ticketsError;

    // Get company settings for user names/emails
    const userIds = [...new Set(tickets?.map(t => t.user_id) || [])];
    const { data: companySettings } = await supabaseClient
      .from("company_settings")
      .select("user_id, company_name, admin_name, admin_email")
      .in("user_id", userIds);

    // Map user info to tickets
    const ticketsWithUserInfo = tickets?.map(ticket => {
      const userInfo = companySettings?.find(c => c.user_id === ticket.user_id);
      return {
        ...ticket,
        user_name: userInfo?.admin_name || "Usuário",
        user_email: userInfo?.admin_email || "-",
        company_name: userInfo?.company_name || "-",
      };
    }) || [];

    console.log("[ADMIN-TICKETS] Found", ticketsWithUserInfo.length, "tickets");

    return new Response(JSON.stringify(ticketsWithUserInfo), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[ADMIN-TICKETS] Error:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
