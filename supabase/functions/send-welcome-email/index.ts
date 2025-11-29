import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WelcomeEmailRequest {
  email: string;
  name?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, name }: WelcomeEmailRequest = await req.json();

    console.log("Sending welcome email to:", email);

    const APP_URL = Deno.env.get("APP_URL") || "https://lbyoniuealghclfuahko.lovable.app";

    const emailResponse = await resend.emails.send({
      from: "Éon Sign <noreply@eongerenciamento.com.br>",
      to: [email],
      subject: "Bem-vindo ao Éon Sign!",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #273d60, #001a4d); padding: 0; text-align: center;">
            <img src="${APP_URL}/email-assets/header-banner.png" alt="Éon Sign" style="width: 100%; max-width: 600px; display: block;" />
          </div>
          <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #273d60;">Bem-vindo ao Éon Sign${name ? `, ${name}` : ''}!</h2>
            <p style="color: #333; font-size: 16px;">
              Estamos muito felizes em tê-lo conosco! O Éon Sign é sua plataforma completa para gestão de documentos e assinatura digital.
            </p>
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #273d60; margin-top: 0;">O que você pode fazer:</h3>
              <ul style="color: #666; line-height: 1.8;">
                <li>Gerenciar seus documentos de forma organizada</li>
                <li>Enviar documentos para assinatura digital</li>
                <li>Acompanhar o status de cada assinatura</li>
                <li>Armazenar documentos assinados com segurança</li>
              </ul>
            </div>
            <p style="color: #333; font-size: 14px;">
              Comece agora mesmo acessando sua conta:
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
                Acessar Minha Conta
              </a>
            </div>
            <p style="color: #999; font-size: 12px; text-align: center;">
              Se você tiver alguma dúvida, entre em contato com nosso suporte.
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

    console.log("Welcome email sent successfully:", emailResponse);

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
