import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WEBHOOK_URL = "https://beyefodsuuftviwthdfe.supabase.co/functions/v1/user-webhook";

interface DeleteMemberRequest {
  memberId: string;
  organizationId: string;
}

async function sendWebhook(payload: object): Promise<void> {
  const apiKey = Deno.env.get("EONSIGN_WEBHOOK_API_KEY");
  
  if (!apiKey) {
    console.log("[DELETE-MEMBER] Webhook API key not configured, skipping");
    return;
  }

  try {
    console.log("[DELETE-MEMBER] Sending webhook:", JSON.stringify(payload));
    
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
      console.error("[DELETE-MEMBER] Webhook failed:", response.status, errorText);
    } else {
      console.log("[DELETE-MEMBER] Webhook sent successfully");
    }
  } catch (error) {
    console.error("[DELETE-MEMBER] Error sending webhook:", error);
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[DELETE-MEMBER] Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Get authenticated user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      console.error("[DELETE-MEMBER] Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Usuário não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { memberId, organizationId }: DeleteMemberRequest = await req.json();

    if (!memberId || !organizationId) {
      return new Response(
        JSON.stringify({ error: "ID do membro e ID da organização são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user is the admin of the organization
    if (user.id !== organizationId) {
      return new Response(
        JSON.stringify({ error: "Você não tem permissão para remover membros desta organização" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get member data before deletion
    const { data: member, error: memberError } = await supabaseAdmin
      .from("organization_members")
      .select("id, member_email, member_user_id, organization_id")
      .eq("id", memberId)
      .eq("organization_id", organizationId)
      .single();

    if (memberError || !member) {
      console.error("[DELETE-MEMBER] Member not found:", memberError);
      return new Response(
        JSON.stringify({ error: "Membro não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get organization name for webhook
    const { data: companyData } = await supabaseAdmin
      .from("company_settings")
      .select("company_name")
      .eq("user_id", organizationId)
      .single();

    const organizationName = companyData?.company_name || "Organização";

    // Delete the member
    const { error: deleteError } = await supabaseAdmin
      .from("organization_members")
      .delete()
      .eq("id", memberId);

    if (deleteError) {
      console.error("[DELETE-MEMBER] Delete error:", deleteError);
      return new Response(
        JSON.stringify({ error: "Erro ao remover membro" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[DELETE-MEMBER] Member deleted successfully:", member.member_email);

    // Send webhook notification
    await sendWebhook({
      event: "user.deleted",
      system_name: "eonsign",
      organization_name: organizationName,
      user: {
        external_id: member.id,
        email: member.member_email,
      },
    });

    return new Response(
      JSON.stringify({ success: true, message: "Membro removido com sucesso" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erro interno";
    console.error("[DELETE-MEMBER] Error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
