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

    const { ticketId, status, message } = await req.json();

    console.log("[ADMIN-UPDATE-TICKET] Updating ticket:", ticketId);

    // Update ticket status if provided
    if (status) {
      const { error: updateError } = await supabaseClient
        .from("support_tickets")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", ticketId);

      if (updateError) throw updateError;
      console.log("[ADMIN-UPDATE-TICKET] Status updated to:", status);
    }

    // Add admin message if provided
    if (message) {
      const { error: messageError } = await supabaseClient
        .from("ticket_messages")
        .insert({
          ticket_id: ticketId,
          user_id: userData.user.id,
          message,
          is_admin: true,
        });

      if (messageError) throw messageError;
      console.log("[ADMIN-UPDATE-TICKET] Admin message added");

      // Update ticket status to em_andamento if it was aberto
      const { data: ticket } = await supabaseClient
        .from("support_tickets")
        .select("status")
        .eq("id", ticketId)
        .single();

      if (ticket?.status === "aberto") {
        await supabaseClient
          .from("support_tickets")
          .update({ status: "em_andamento", updated_at: new Date().toISOString() })
          .eq("id", ticketId);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[ADMIN-UPDATE-TICKET] Error:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
