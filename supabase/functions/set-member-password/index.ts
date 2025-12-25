import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SetPasswordRequest {
  email: string;
  token: string;
  newPassword: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const { email, token, newPassword }: SetPasswordRequest = await req.json();

    console.log("Set password request for email:", email);

    if (!email || !token || !newPassword) {
      return new Response(
        JSON.stringify({ error: "Email, token e nova senha são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate password strength
    if (newPassword.length < 8) {
      return new Response(
        JSON.stringify({ error: "A senha deve ter pelo menos 8 caracteres" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find the member with matching email and token
    const { data: member, error: memberError } = await supabaseAdmin
      .from("organization_members")
      .select("*")
      .eq("member_email", email)
      .eq("invitation_token", token)
      .eq("status", "pending")
      .single();

    if (memberError || !member) {
      console.error("Member not found or token invalid:", memberError);
      return new Response(
        JSON.stringify({ error: "Token inválido ou expirado. Solicite um novo convite." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if token has expired
    if (member.token_expires_at && new Date(member.token_expires_at) < new Date()) {
      console.error("Token expired for email:", email);
      return new Response(
        JSON.stringify({ error: "Token expirado. Solicite um novo convite." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the user by email
    const { data: usersData, error: getUserError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (getUserError) {
      console.error("Error listing users:", getUserError);
      return new Response(
        JSON.stringify({ error: "Erro ao buscar usuário" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const user = usersData.users.find(u => u.email === email);

    if (!user) {
      console.error("User not found for email:", email);
      return new Response(
        JSON.stringify({ error: "Usuário não encontrado. Solicite um novo convite." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update the user's password
    const { error: updatePasswordError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password: newPassword, email_confirm: true }
    );

    if (updatePasswordError) {
      console.error("Error updating password:", updatePasswordError);
      return new Response(
        JSON.stringify({ error: "Erro ao definir senha. Tente novamente." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update member status to active and clear the token
    const { error: updateMemberError } = await supabaseAdmin
      .from("organization_members")
      .update({
        status: "active",
        member_user_id: user.id,
        accepted_at: new Date().toISOString(),
        invitation_token: null,
        token_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", member.id);

    if (updateMemberError) {
      console.error("Error updating member status:", updateMemberError);
      // Don't fail the request since password was already set
    }

    console.log("Password set successfully for:", email);

    return new Response(
      JSON.stringify({ success: true, message: "Senha definida com sucesso" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in set-member-password:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
