import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";
import { renderEmailShell, renderCredentialsBox, renderActionButton } from "../_shared/email-template.ts";

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
    console.log("[DEBUG] APP_URL secret value:", Deno.env.get("APP_URL"));

    let APP_URL = Deno.env.get("APP_URL") || "https://sign.eonhub.com.br";
    // Garantir que tenha https://
    if (APP_URL && !APP_URL.startsWith("http")) {
      APP_URL = `https://${APP_URL}`;
    }
    console.log("[DEBUG] APP_URL being used:", APP_URL);
    console.log("[DEBUG] Auth URL will be:", `${APP_URL}/auth`);
    const supabase = createClient(supabaseUrl, supabaseKey);
    const BANNER_URL = `${supabaseUrl}/storage/v1/object/public/email-assets/header-banner-v2.png`;

    const displayName = name || organizationName || "Usuário";
    const displayOrganization = organizationName || name || "Sua Organização";
    const displayTier = tierName || "Básico";

    const credentialRows = [{ label: "E-mail", value: email }];
    if (tempPassword) credentialRows.push({ label: "Senha", value: tempPassword });
    credentialRows.push({ label: "Organização", value: displayOrganization });
    credentialRows.push({ label: "Plano", value: displayTier });

    const contentHtml = `
      <h2 style="color:#273d60; margin-top:0; font-size:20px;">Bem-Vindo ao eonSign, ${displayName}!</h2>
      <p style="color:#333; font-size:14px;">
        Sua conta foi criada com sucesso. Aqui estão suas credenciais de acesso:
      </p>
      ${renderCredentialsBox(credentialRows)}
      <p style="color:#666; font-size:12px;">
        Recomendamos que você altere sua senha após o primeiro acesso.
      </p>
      ${renderActionButton(`${APP_URL}/auth`, "Acessar o Sistema")}
    `;

    const emailResponse = await resend.emails.send({
      from: "eonSign <noreply@eonhub.com.br>",
      to: [email],
      subject: "Bem-Vindo ao eonSign",
      html: renderEmailShell(contentHtml, { bannerUrl: BANNER_URL }),
    });

    console.log("Welcome email sent successfully:", emailResponse);

    // Salvar no histórico se tivermos userId
    if (userId) {
      await supabase.from("email_history").insert({
        user_id: userId,
        recipient_email: email,
        subject: "Bem-Vindo ao eonSign",
        email_type: "welcome",
        status: "sent",
      });
    }

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending welcome email:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
