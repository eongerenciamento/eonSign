import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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
      .from('company_settings')
      .select('admin_name, user_id')
      .eq('admin_email', email)
      .single();

    if (queryError || !companyData) {
      console.error("User not found in company_settings:", queryError);
      return new Response(
        JSON.stringify({ error: "Usuário não encontrado" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Extrair o primeiro nome
    const firstName = companyData.admin_name.split(' ')[0];
    console.log("Setting new password to first name:", firstName);

    // Definir a nova senha usando o Supabase Admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      companyData.user_id,
      { password: firstName }
    );

    if (updateError) {
      console.error("Error updating password:", updateError);
      return new Response(
        JSON.stringify({ error: "Erro ao atualizar senha" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const APP_URL = Deno.env.get("APP_URL") || "https://lbyoniuealghclfuahko.lovable.app";

    // Enviar email com as credenciais
    const emailResponse = await resend.emails.send({
      from: "Éon Sign <noreply@eongerenciamento.com.br>",
      to: [email],
      subject: "Nova Senha - Éon Sign",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #273d60, #001a4d); padding: 0; text-align: center;">
            <img src="${APP_URL}/email-assets/header-banner.png" alt="Éon Sign" style="width: 100%; max-width: 600px; display: block;" />
          </div>
          <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #273d60;">Nova Senha Gerada</h2>
            <p style="color: #333; font-size: 16px;">
              Sua senha foi redefinida com sucesso. Utilize as credenciais abaixo para acessar o sistema:
            </p>
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 10px 0; color: #333; font-size: 16px;">
                <strong>Login:</strong> ${email}
              </p>
              <p style="margin: 10px 0; color: #333; font-size: 16px;">
                <strong>Nova Senha:</strong> ${firstName}
              </p>
            </div>
            <p style="color: #666; font-size: 14px;">
              Por motivos de segurança, recomendamos que você altere sua senha após fazer login.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${APP_URL}/auth" 
                 style="background: linear-gradient(135deg, #273d60, #001a4d); 
                        color: white; 
                        padding: 15px 40px; 
                        text-decoration: none; 
                        border-radius: 8px;
                        font-weight: bold;
                        display: inline-block;">
                Acessar Sistema
              </a>
            </div>
          </div>
          <div style="background: #273d60; padding: 20px; text-align: center;">
            <p style="color: white; margin: 0; font-size: 12px;">
              © 2024 Éon Sign - Sistema de Gestão de Documentos e Assinatura Digital
            </p>
          </div>
        </div>
      `,
    });

    console.log("Password reset email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending password reset email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
