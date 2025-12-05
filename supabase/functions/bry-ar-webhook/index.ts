import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

function getEmailHeader() {
  return `
    <tr>
      <td style="background: linear-gradient(135deg, #273d60 0%, #001a4d 100%); padding: 30px; text-align: center;">
        <img src="https://lbyoniuealghclfuahko.supabase.co/storage/v1/object/public/email-assets/header-banner.png" alt="Eon Sign" style="max-width: 200px; height: auto; margin: 0 auto;">
      </td>
    </tr>
  `;
}

function getEmailFooter() {
  const currentYear = new Date().getFullYear();
  return `
    <tr>
      <td style="background-color: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
        <p style="color: #64748b; font-size: 12px; margin: 0;">
          © ${currentYear} Eon Sign. Todos os direitos reservados.
        </p>
      </td>
    </tr>
  `;
}

async function sendApprovedEmail(email: string, commonName: string, protocol: string, emissionUrl: string) {
  const appUrl = Deno.env.get("APP_URL") || "https://sign.eongerenciamento.com.br";

  try {
    await resend.emails.send({
      from: "Eon Sign <noreply@eongerenciamento.com.br>",
      to: [email],
      subject: "Certificado Aprovado - Pronto para Emissão",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px 0;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                  ${getEmailHeader()}
                  <tr>
                    <td style="padding: 40px 30px;">
                      <h1 style="color: #273d60; font-size: 24px; margin: 0 0 20px 0; text-align: center;">
                        🎉 Certificado Aprovado!
                      </h1>
                      <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                        Olá <strong>${commonName}</strong>,
                      </p>
                      <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                        Sua solicitação de certificado digital foi <strong style="color: #22c55e;">aprovada</strong> e está pronta para emissão.
                      </p>
                      <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #273d60;">
                        <p style="color: #666; font-size: 14px; margin: 0;">
                          <strong>Protocolo:</strong> ${protocol}
                        </p>
                      </div>
                      <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                        Clique no botão abaixo para acessar o ambiente de emissão e concluir o processo de instalação do seu certificado digital.
                      </p>
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td align="center">
                            <a href="${appUrl}/certificados" style="display: inline-block; background: linear-gradient(135deg, #273d60 0%, #001a4d 100%); color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 6px; font-size: 16px; font-weight: 600;">
                              Emitir Certificado
                            </a>
                          </td>
                        </tr>
                      </table>
                      <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0; text-align: center;">
                        Ou acesse diretamente: <a href="${appUrl}/certificados" style="color: #273d60;">${appUrl}/certificados</a>
                      </p>
                    </td>
                  </tr>
                  ${getEmailFooter()}
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });
    console.log("Approved notification email sent to:", email);
  } catch (error) {
    console.error("Error sending approved email:", error);
  }
}

async function sendIssuedEmail(email: string, commonName: string, protocol: string) {
  const appUrl = Deno.env.get("APP_URL") || "https://sign.eongerenciamento.com.br";

  try {
    await resend.emails.send({
      from: "Eon Sign <noreply@eongerenciamento.com.br>",
      to: [email],
      subject: "Certificado Digital Emitido com Sucesso!",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px 0;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                  ${getEmailHeader()}
                  <tr>
                    <td style="padding: 40px 30px;">
                      <h1 style="color: #273d60; font-size: 24px; margin: 0 0 20px 0; text-align: center;">
                        🏆 Certificado Emitido!
                      </h1>
                      <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                        Olá <strong>${commonName}</strong>,
                      </p>
                      <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                        Parabéns! Seu certificado digital ICP-Brasil foi <strong style="color: #22c55e;">emitido com sucesso</strong> e está disponível para download.
                      </p>
                      <div style="background-color: #f0fdf4; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #22c55e;">
                        <p style="color: #166534; font-size: 14px; margin: 0;">
                          <strong>✓ Certificado pronto para uso</strong><br>
                          Protocolo: ${protocol}
                        </p>
                      </div>
                      <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                        Acesse a plataforma para baixar seu certificado digital (arquivo .pfx) e começar a assinar documentos com validade jurídica.
                      </p>
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td align="center">
                            <a href="${appUrl}/certificados" style="display: inline-block; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 6px; font-size: 16px; font-weight: 600;">
                              Baixar Certificado
                            </a>
                          </td>
                        </tr>
                      </table>
                      <div style="background-color: #fef3c7; border-radius: 8px; padding: 15px; margin: 30px 0 0 0; border-left: 4px solid #f59e0b;">
                        <p style="color: #92400e; font-size: 13px; margin: 0;">
                          <strong>⚠️ Importante:</strong> Guarde a senha do certificado em local seguro. Ela será necessária para instalar e usar o certificado.
                        </p>
                      </div>
                    </td>
                  </tr>
                  ${getEmailFooter()}
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });
    console.log("Issued notification email sent to:", email);
  } catch (error) {
    console.error("Error sending issued email:", error);
  }
}

async function sendRejectedEmail(email: string, commonName: string, protocol: string, rejectionReason?: string) {
  const appUrl = Deno.env.get("APP_URL") || "https://sign.eongerenciamento.com.br";

  try {
    await resend.emails.send({
      from: "Eon Sign <noreply@eongerenciamento.com.br>",
      to: [email],
      subject: "Solicitação de Certificado Rejeitada",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px 0;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                  ${getEmailHeader()}
                  <tr>
                    <td style="padding: 40px 30px;">
                      <h1 style="color: #dc2626; font-size: 24px; margin: 0 0 20px 0; text-align: center;">
                        ❌ Solicitação Rejeitada
                      </h1>
                      <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                        Olá <strong>${commonName}</strong>,
                      </p>
                      <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                        Infelizmente, sua solicitação de certificado digital foi <strong style="color: #dc2626;">rejeitada</strong>.
                      </p>
                      <div style="background-color: #fef2f2; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #dc2626;">
                        <p style="color: #991b1b; font-size: 14px; margin: 0;">
                          <strong>Protocolo:</strong> ${protocol}<br>
                          ${rejectionReason ? `<strong>Motivo:</strong> ${rejectionReason}` : ''}
                        </p>
                      </div>
                      <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                        Você pode iniciar uma nova solicitação com as informações corrigidas ou entrar em contato com nosso suporte para mais informações.
                      </p>
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td align="center">
                            <a href="${appUrl}/certificados" style="display: inline-block; background: linear-gradient(135deg, #273d60 0%, #001a4d 100%); color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 6px; font-size: 16px; font-weight: 600;">
                              Nova Solicitação
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  ${getEmailFooter()}
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });
    console.log("Rejected notification email sent to:", email);
  } catch (error) {
    console.error("Error sending rejected email:", error);
  }
}

async function sendValidationRejectedEmail(email: string, commonName: string, protocol: string) {
  const appUrl = Deno.env.get("APP_URL") || "https://sign.eongerenciamento.com.br";

  try {
    await resend.emails.send({
      from: "Eon Sign <noreply@eongerenciamento.com.br>",
      to: [email],
      subject: "Validação de Certificado Pendente - Ação Necessária",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px 0;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                  ${getEmailHeader()}
                  <tr>
                    <td style="padding: 40px 30px;">
                      <h1 style="color: #f59e0b; font-size: 24px; margin: 0 0 20px 0; text-align: center;">
                        ⚠️ Validação Pendente
                      </h1>
                      <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                        Olá <strong>${commonName}</strong>,
                      </p>
                      <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                        Sua solicitação de certificado digital foi devolvida pela central de verificação e precisa de ajustes.
                      </p>
                      <div style="background-color: #fef3c7; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                        <p style="color: #92400e; font-size: 14px; margin: 0;">
                          <strong>Protocolo:</strong> ${protocol}<br>
                          <strong>Status:</strong> Aguardando correção de documentos
                        </p>
                      </div>
                      <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                        Por favor, verifique os documentos enviados e faça as correções necessárias. Após os ajustes, sua solicitação será reavaliada.
                      </p>
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td align="center">
                            <a href="${appUrl}/certificados" style="display: inline-block; background: linear-gradient(135deg, #273d60 0%, #001a4d 100%); color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 6px; font-size: 16px; font-weight: 600;">
                              Verificar Solicitação
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  ${getEmailFooter()}
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });
    console.log("Validation rejected notification email sent to:", email);
  } catch (error) {
    console.error("Error sending validation rejected email:", error);
  }
}

async function sendRevokedEmail(email: string, commonName: string, protocol: string) {
  try {
    await resend.emails.send({
      from: "Eon Sign <noreply@eongerenciamento.com.br>",
      to: [email],
      subject: "Certificado Digital Revogado",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px 0;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                  ${getEmailHeader()}
                  <tr>
                    <td style="padding: 40px 30px;">
                      <h1 style="color: #dc2626; font-size: 24px; margin: 0 0 20px 0; text-align: center;">
                        🔒 Certificado Revogado
                      </h1>
                      <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                        Olá <strong>${commonName}</strong>,
                      </p>
                      <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                        Informamos que seu certificado digital foi <strong style="color: #dc2626;">revogado</strong> e não poderá mais ser utilizado para assinaturas digitais.
                      </p>
                      <div style="background-color: #fef2f2; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #dc2626;">
                        <p style="color: #991b1b; font-size: 14px; margin: 0;">
                          <strong>Protocolo:</strong> ${protocol}<br>
                          <strong>Status:</strong> Certificado revogado
                        </p>
                      </div>
                      <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                        Se você não solicitou a revogação ou tem dúvidas sobre este procedimento, entre em contato com nosso suporte imediatamente.
                      </p>
                    </td>
                  </tr>
                  ${getEmailFooter()}
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });
    console.log("Revoked notification email sent to:", email);
  } catch (error) {
    console.error("Error sending revoked email:", error);
  }
}

async function sendInValidationEmail(email: string, commonName: string, protocol: string) {
  const appUrl = Deno.env.get("APP_URL") || "https://sign.eongerenciamento.com.br";

  try {
    await resend.emails.send({
      from: "Eon Sign <noreply@eongerenciamento.com.br>",
      to: [email],
      subject: "Solicitação de Certificado em Análise",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px 0;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                  ${getEmailHeader()}
                  <tr>
                    <td style="padding: 40px 30px;">
                      <h1 style="color: #f59e0b; font-size: 24px; margin: 0 0 20px 0; text-align: center;">
                        🔍 Solicitação em Análise
                      </h1>
                      <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                        Olá <strong>${commonName}</strong>,
                      </p>
                      <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                        Sua solicitação de certificado digital foi encaminhada para a <strong>central de verificação</strong> e está sendo analisada.
                      </p>
                      <div style="background-color: #fef3c7; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                        <p style="color: #92400e; font-size: 14px; margin: 0;">
                          <strong>Protocolo:</strong> ${protocol}<br>
                          <strong>Status:</strong> Aguardando verificação
                        </p>
                      </div>
                      <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                        Você receberá um novo e-mail assim que a análise for concluída. O prazo médio de análise é de 1 a 3 dias úteis.
                      </p>
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td align="center">
                            <a href="${appUrl}/certificados" style="display: inline-block; background: linear-gradient(135deg, #273d60 0%, #001a4d 100%); color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 6px; font-size: 16px; font-weight: 600;">
                              Acompanhar Status
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  ${getEmailFooter()}
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });
    console.log("In validation notification email sent to:", email);
  } catch (error) {
    console.error("Error sending in validation email:", error);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const webhookData = await req.json();
    console.log("BRy AR webhook received:", JSON.stringify(webhookData, null, 2));

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Extract protocol and status from webhook
    const protocol = webhookData.protocol;
    const status = webhookData.action === "status" ? webhookData.result || webhookData.status : webhookData.result || webhookData.status;

    if (!protocol) {
      console.log("No protocol in webhook data");
      return new Response(
        JSON.stringify({ code: 200, status: "success" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Updating certificate request ${protocol} to status: ${status}`);

    // Map BRy status to our status (including all possible statuses)
    const statusMap: Record<string, string> = {
      created: "created",
      received: "pending",
      recived: "pending", // BRy typo in docs
      in_validation: "in_validation",
      approved: "approved",
      pending_authentication: "pending_authentication",
      validation_rejected: "validation_rejected",
      rejected: "rejected",
      issued: "issued",
      revoked: "revoked",
    };

    const mappedStatus = statusMap[status?.toLowerCase()] || status;

    // First, get the certificate request to retrieve CPF and email
    const { data: certRequest, error: fetchError } = await supabase
      .from("certificate_requests")
      .select("cpf, common_name, email")
      .eq("protocol", protocol)
      .single();

    if (fetchError) {
      console.error("Error fetching certificate request:", fetchError);
    }

    // Build update data
    const updateData: Record<string, any> = {
      status: mappedStatus,
      updated_at: new Date().toISOString(),
    };

    // Handle specific status updates
    let emissionUrl = "";
    
    // Handle approved status - store emission URL
    if (status === "approved" && certRequest) {
      updateData.approved_at = new Date().toISOString();
      
      // Construct emission URL with CPF and protocol
      const cleanCpf = certRequest.cpf.replace(/\D/g, "");
      const bryEnvironment = Deno.env.get("BRY_ENVIRONMENT") || "hom";
      const baseUrl = bryEnvironment === "prod" 
        ? "https://mp-universal.bry.com.br"
        : "https://mp-universal.hom.bry.com.br";
      
      emissionUrl = `${baseUrl}/protocolo/emissao?cpf=${cleanCpf}&protocolo=${protocol}`;
      updateData.emission_url = emissionUrl;
      
      console.log(`Generated emission URL for approved certificate: ${emissionUrl}`);
    }

    // Handle issued status - store certificate data if provided
    if (status === "issued") {
      updateData.issued_at = new Date().toISOString();
      updateData.certificate_issued = true;
      
      // Store PFX data if provided by webhook
      if (webhookData.pfx_data) {
        updateData.pfx_data = webhookData.pfx_data;
        console.log("Stored PFX data from webhook");
      }
      
      if (webhookData.pfx_password) {
        updateData.pfx_password = webhookData.pfx_password;
        console.log("Stored PFX password from webhook");
      }
      
      if (webhookData.certificate_serial) {
        updateData.certificate_serial = webhookData.certificate_serial;
      }
      
      if (webhookData.valid_from) {
        updateData.certificate_valid_from = webhookData.valid_from;
      }
      
      if (webhookData.valid_until) {
        updateData.certificate_valid_until = webhookData.valid_until;
      }
    }

    // Handle rejected status - store rejection reason
    if (status === "rejected" || status === "validation_rejected") {
      if (webhookData.rejection_reason || webhookData.reason || webhookData.message) {
        updateData.rejection_reason = webhookData.rejection_reason || webhookData.reason || webhookData.message;
      }
    }

    // Handle revoked status
    if (status === "revoked") {
      updateData.revoked_at = new Date().toISOString();
    }

    // Update the certificate request in database
    const { data, error } = await supabase
      .from("certificate_requests")
      .update(updateData)
      .eq("protocol", protocol)
      .select()
      .single();

    if (error) {
      console.error("Database update error:", error);
    } else {
      console.log("Certificate request updated:", data);
    }

    // Send email notifications based on status
    if (certRequest?.email && certRequest?.common_name) {
      const normalizedStatus = status?.toLowerCase();
      
      if (normalizedStatus === "approved") {
        await sendApprovedEmail(
          certRequest.email, 
          certRequest.common_name, 
          protocol, 
          emissionUrl
        );
      } else if (normalizedStatus === "issued") {
        await sendIssuedEmail(
          certRequest.email, 
          certRequest.common_name, 
          protocol
        );
      } else if (normalizedStatus === "rejected") {
        await sendRejectedEmail(
          certRequest.email, 
          certRequest.common_name, 
          protocol,
          updateData.rejection_reason
        );
      } else if (normalizedStatus === "validation_rejected") {
        await sendValidationRejectedEmail(
          certRequest.email, 
          certRequest.common_name, 
          protocol
        );
      } else if (normalizedStatus === "revoked") {
        await sendRevokedEmail(
          certRequest.email, 
          certRequest.common_name, 
          protocol
        );
      } else if (normalizedStatus === "in_validation") {
        await sendInValidationEmail(
          certRequest.email, 
          certRequest.common_name, 
          protocol
        );
      }
    }

    // Return success response as expected by BRy
    return new Response(
      JSON.stringify({ code: 200, status: "success" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Webhook processing error:", error);
    return new Response(
      JSON.stringify({ code: 500, status: "error", message: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
