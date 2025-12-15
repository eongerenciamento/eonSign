import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WelcomeEmailRequest {
  email: string;
  name?: string;
  userId?: string;
  tempPassword?: string;
  organizationName?: string;
  tierName?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, name, userId, tempPassword, organizationName, tierName }: WelcomeEmailRequest = await req.json();

    console.log("Sending welcome email to:", email);

    const APP_URL = Deno.env.get("APP_URL") || "https://sign.eonhub.com.br";
    const supabase = createClient(supabaseUrl, supabaseKey);
    const BANNER_URL = `${supabaseUrl}/storage/v1/object/public/email-assets/header-banner.png`;

    const displayName = name || organizationName || 'Usuário';
    const displayOrganization = organizationName || name || 'Sua Organização';
    const displayTier = tierName || 'Básico';

    const emailResponse = await resend.emails.send({
      from: "Eon Sign <noreply@eonhub.com.br>",
      to: [email],
      subject: "Bem-Vindo ao Eon Sign",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f3f4f6;">
          <div style="border-radius: 16px 16px 0 0; overflow: hidden;">
            <img src="${BANNER_URL}" alt="Eon Sign" style="width: 100%; max-width: 600px; display: block; margin: 0 auto;" />
          </div>
          <div style="padding: 30px; background: #f3f4f6;">
            <h1 style="color: #273d60; font-size: 24px; margin: 0 0 20px 0;">Bem-Vindo ao Eon Sign, ${displayName}!</h1>
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              Sua conta foi criada com sucesso. Aqui estão suas credenciais de acesso:
            </p>
            <div style="background: white; border-radius: 12px; padding: 24px; margin: 0 0 24px 0;">
              <p style="color: #374151; font-size: 15px; margin: 0 0 12px 0;">
                <strong style="color: #273d60;">E-mail:</strong> ${email}
              </p>
              ${tempPassword ? `
              <p style="color: #374151; font-size: 15px; margin: 0 0 12px 0;">
                <strong style="color: #273d60;">Senha:</strong> ${tempPassword}
              </p>
              ` : ''}
              <p style="color: #374151; font-size: 15px; margin: 0 0 12px 0;">
                <strong style="color: #273d60;">Organização:</strong> ${displayOrganization}
              </p>
              <p style="color: #374151; font-size: 15px; margin: 0;">
                <strong style="color: #273d60;">Plano:</strong> ${displayTier}
              </p>
            </div>
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;">
              Recomendamos que você altere sua senha após o primeiro acesso.
            </p>
            <div style="margin: 0 0 24px 0;">
              <a href="${APP_URL}/auth" 
                 style="background: #273d60; 
                        color: white; 
                        padding: 14px 32px; 
                        text-decoration: none; 
                        border-radius: 8px;
                        font-weight: 600;
                        font-size: 15px;
                        display: inline-block;">
                Acessar o Sistema
              </a>
            </div>
          </div>
          <div style="border-top: 1px solid #e5e7eb;"></div>
          <div style="background: #f3f4f6; padding: 20px; text-align: center; border-radius: 0 0 16px 16px;">
            <p style="color: #6b7280; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} Eon Sign. Todos os direitos reservados.
            </p>
          </div>
        </div>
      `,
    });

    console.log("Welcome email sent successfully:", emailResponse);

    // Salvar no histórico se tivermos userId
    if (userId) {
      await supabase.from('email_history').insert({
        user_id: userId,
        recipient_email: email,
        subject: "Bem-Vindo ao Eon Sign",
        email_type: 'welcome',
        status: 'sent'
      });
    }

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending welcome email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
