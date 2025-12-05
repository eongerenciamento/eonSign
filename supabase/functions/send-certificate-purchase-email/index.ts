import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-CERTIFICATE-PURCHASE-EMAIL] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const { email, name } = await req.json();

    if (!email || !name) {
      throw new Error("Email and name are required");
    }

    logStep("Sending email", { email, name });

    const appUrl = Deno.env.get("APP_URL") || "https://sign.eongerenciamento.com.br";
    const currentYear = new Date().getFullYear();

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <!-- Header Banner -->
                <tr>
                  <td>
                    <img src="https://lbyoniuealghclfuahko.supabase.co/storage/v1/object/public/email-assets/header-banner.png" 
                         alt="Eon Sign" 
                         style="width: 100%; display: block; margin: 0 auto;">
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px 40px 20px 40px;">
                    <h1 style="color: #273d60; margin: 0 0 20px 0; font-size: 24px;">
                      Compra Confirmada! 🎉
                    </h1>
                    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                      Olá <strong>${name}</strong>,
                    </p>
                    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                      Seu pagamento para o <strong>Certificado Digital A1</strong> foi confirmado com sucesso!
                    </p>
                    
                    <!-- Order Details -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
                      <tr>
                        <td style="padding: 20px;">
                          <p style="color: #64748b; font-size: 14px; margin: 0 0 10px 0;">Detalhes da compra:</p>
                          <table width="100%" cellpadding="5" cellspacing="0">
                            <tr>
                              <td style="color: #374151; font-size: 14px;">Produto:</td>
                              <td style="color: #374151; font-size: 14px; text-align: right; font-weight: bold;">Eon Certifica A1</td>
                            </tr>
                            <tr>
                              <td style="color: #374151; font-size: 14px;">Valor:</td>
                              <td style="color: #374151; font-size: 14px; text-align: right; font-weight: bold;">R$ 109,90</td>
                            </tr>
                            <tr>
                              <td style="color: #374151; font-size: 14px;">Validade:</td>
                              <td style="color: #374151; font-size: 14px; text-align: right; font-weight: bold;">12 meses</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                      <strong>Próximos passos:</strong>
                    </p>
                    <ol style="color: #374151; font-size: 14px; line-height: 1.8; padding-left: 20px; margin: 0 0 20px 0;">
                      <li>Acesse sua conta no Eon Sign</li>
                      <li>Vá até a seção "Certificado Digital"</li>
                      <li>Clique em "Continuar Processo" no certificado pago</li>
                      <li>Envie seu documento de identificação (CNH)</li>
                      <li>Participe da videoconferência de validação</li>
                      <li>Baixe seu certificado digital!</li>
                    </ol>
                  </td>
                </tr>

                <!-- CTA Button -->
                <tr>
                  <td style="padding: 0 40px 40px 40px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center">
                          <a href="${appUrl}/certificados" 
                             style="display: inline-block; background: linear-gradient(135deg, #273d60, #001a4d); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; font-size: 16px;">
                            Acessar Meus Certificados
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #f4f4f5; padding: 20px 40px; text-align: center;">
                    <p style="color: #6b7280; font-size: 12px; margin: 0;">
                      © ${currentYear} Eon Sign. Todos os direitos reservados.
                    </p>
                    <p style="color: #6b7280; font-size: 12px; margin: 10px 0 0 0;">
                      Este email foi enviado porque você realizou uma compra em nosso sistema.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const emailResponse = await resend.emails.send({
      from: "Eon Sign <noreply@eongerenciamento.com.br>",
      to: [email],
      subject: "Compra do Certificado Digital Confirmada! 🎉",
      html: emailHtml,
    });

    logStep("Email sent successfully", { emailResponse });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    logStep("Error", { message: error.message });

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
