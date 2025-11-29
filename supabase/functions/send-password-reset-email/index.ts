import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PasswordResetEmailRequest {
  email: string;
  resetLink: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, resetLink }: PasswordResetEmailRequest = await req.json();

    console.log("Sending password reset email to:", email);

    const APP_URL = Deno.env.get("APP_URL") || "https://lbyoniuealghclfuahko.lovable.app";

    const emailResponse = await resend.emails.send({
      from: "Éon Sign <noreply@eongerenciamento.com.br>",
      to: [email],
      subject: "Recuperação de Senha - Éon Sign",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #273d60, #001a4d); padding: 0; text-align: center;">
            <img src="${APP_URL}/email-assets/header-banner.png" alt="Éon Sign" style="width: 100%; max-width: 600px; display: block;" />
          </div>
          <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #273d60;">Recuperação de Senha</h2>
            <p style="color: #333; font-size: 16px;">
              Recebemos uma solicitação para redefinir a senha da sua conta no Éon Sign.
            </p>
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #666;">
                Se você não solicitou esta alteração, pode ignorar este e-mail com segurança. 
                Sua senha permanecerá inalterada.
              </p>
            </div>
            <p style="color: #333; font-size: 14px;">
              Para criar uma nova senha, clique no botão abaixo:
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" 
                 style="background: linear-gradient(135deg, #273d60, #001a4d); 
                        color: white; 
                        padding: 15px 40px; 
                        text-decoration: none; 
                        border-radius: 8px;
                        font-weight: bold;
                        display: inline-block;">
                Redefinir Senha
              </a>
            </div>
            <p style="color: #999; font-size: 12px; text-align: center;">
              Se o botão não funcionar, copie e cole este link no seu navegador:<br>
              <a href="${resetLink}" style="color: #273d60;">${resetLink}</a>
            </p>
            <p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px;">
              Este link expira em 1 hora por motivos de segurança.
            </p>
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
