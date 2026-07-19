import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { renderEmailShell, renderCredentialsBox, renderActionButton } from "../_shared/email-template.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PasswordResetEmailRequest {
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email }: PasswordResetEmailRequest = await req.json();

    console.log("Processing password reset for:", email);

    // Buscar o admin_name na tabela company_settings usando o email
    const { data: companyData, error: queryError } = await supabaseAdmin
      .from("company_settings")
      .select("admin_name, user_id")
      .eq("admin_email", email)
      .single();

    if (queryError || !companyData) {
      console.error("User not found in company_settings:", queryError);
      return new Response(JSON.stringify({ error: "Usuário não encontrado" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Gerar senha aleatória de 8 caracteres
    const generateRandomPassword = () => {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
      let password = "";
      for (let i = 0; i < 8; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return password;
    };

    const newPassword = generateRandomPassword();
    console.log("Setting new random password for user:", companyData.user_id);

    // Definir a nova senha usando o Supabase Admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(companyData.user_id, {
      password: newPassword,
    });

    if (updateError) {
      console.error("Error updating password:", updateError);
      return new Response(JSON.stringify({ error: "Erro ao atualizar senha" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log("[DEBUG] APP_URL secret value:", Deno.env.get("APP_URL"));
    let APP_URL = Deno.env.get("APP_URL") || "https://sign.eonhub.com.br";
    // Garantir que tenha https://
    if (APP_URL && !APP_URL.startsWith("http")) {
      APP_URL = `https://${APP_URL}`;
    }
    console.log("[DEBUG] APP_URL being used:", APP_URL);
    console.log("[DEBUG] Auth URL will be:", `${APP_URL}/auth`);
    const BANNER_URL = `${supabaseUrl}/storage/v1/object/public/email-assets/header-banner-v2.png`;

    // Enviar email com as credenciais
    const contentHtml = `
      <h2 style="color:#273d60; margin-top:0; font-size:20px;">Nova Senha Gerada</h2>
      <p style="color:#333; font-size:14px;">Sua senha foi redefinida com sucesso.</p>
      ${renderCredentialsBox([
        { label: "Login", value: email },
        { label: "Nova Senha", value: newPassword },
      ])}
      <p style="color:#666; font-size:12px;">
        Por motivos de segurança, recomendamos que você altere sua senha após fazer login.
      </p>
      ${renderActionButton(`${APP_URL}/auth`, "Acessar Sistema")}
    `;

    const emailResponse = await resend.emails.send({
      from: "eonSign <noreply@eonhub.com.br>",
      to: [email],
      subject: "Nova Senha",
      html: renderEmailShell(contentHtml, { bannerUrl: BANNER_URL }),
    });

    console.log("Password reset email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending password reset email:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
