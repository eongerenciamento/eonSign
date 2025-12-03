import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvitationRequest {
  memberEmail: string;
  organizationId: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[MEMBER-INVITATION] Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get authenticated user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      console.error("[MEMBER-INVITATION] Auth error:", authError);
      throw new Error("Usuário não autenticado");
    }

    console.log("[MEMBER-INVITATION] User authenticated:", user.id);

    const { memberEmail, organizationId }: InvitationRequest = await req.json();

    if (!memberEmail || !organizationId) {
      throw new Error("E-mail e ID da organização são obrigatórios");
    }

    // Verify user is the admin of the organization
    if (user.id !== organizationId) {
      throw new Error("Você não tem permissão para convidar membros nesta organização");
    }

    console.log("[MEMBER-INVITATION] Inviting member:", memberEmail);

    // Get organization info
    const { data: companyData, error: companyError } = await supabaseAdmin
      .from("company_settings")
      .select("company_name, admin_name")
      .eq("user_id", organizationId)
      .single();

    if (companyError) {
      console.error("[MEMBER-INVITATION] Company error:", companyError);
      throw new Error("Erro ao buscar dados da organização");
    }

    const organizationName = companyData?.company_name || "Organização";
    const adminName = companyData?.admin_name || "Administrador";

    // Check if member already exists
    const { data: existingMember } = await supabaseAdmin
      .from("organization_members")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("member_email", memberEmail.toLowerCase())
      .single();

    if (existingMember) {
      throw new Error("Este e-mail já foi convidado para a organização");
    }

    // Create member record
    const { error: insertError } = await supabaseAdmin
      .from("organization_members")
      .insert({
        organization_id: organizationId,
        member_email: memberEmail.toLowerCase(),
        role: "member",
        status: "pending"
      });

    if (insertError) {
      console.error("[MEMBER-INVITATION] Insert error:", insertError);
      throw new Error("Erro ao criar convite");
    }

    console.log("[MEMBER-INVITATION] Member record created");

    // Send invitation email
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const appUrl = Deno.env.get("APP_URL") || "https://sign.eongerenciamento.com.br";

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #273d60 0%, #001f3f 100%); padding: 30px; text-align: center;">
                    <img src="https://lbyoniuealghclfuahko.supabase.co/storage/v1/object/public/email-assets/header-banner.png" alt="Eon Sign" style="max-width: 200px; height: auto; margin: 0 auto;">
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <h1 style="margin: 0 0 20px 0; color: #273d60; font-size: 24px; font-weight: bold;">
                      Você foi convidado!
                    </h1>
                    <p style="margin: 0 0 20px 0; color: #4a5568; font-size: 16px; line-height: 1.6;">
                      Olá,
                    </p>
                    <p style="margin: 0 0 20px 0; color: #4a5568; font-size: 16px; line-height: 1.6;">
                      <strong>${adminName}</strong> convidou você para fazer parte da organização <strong>${organizationName}</strong> no Eon Sign.
                    </p>
                    <p style="margin: 0 0 30px 0; color: #4a5568; font-size: 16px; line-height: 1.6;">
                      Como membro da organização, você terá acesso à plataforma utilizando a assinatura da empresa, sem custos adicionais.
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center">
                          <a href="${appUrl}/auth?invitation=${encodeURIComponent(memberEmail)}" 
                             style="display: inline-block; background: linear-gradient(135deg, #273d60 0%, #001f3f 100%); color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-weight: bold; font-size: 16px;">
                            Aceitar Convite
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 30px 0 0 0; color: #718096; font-size: 14px; line-height: 1.6;">
                      Se você não esperava este convite, pode ignorar este e-mail.
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="background-color: #f7fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="margin: 0; color: #718096; font-size: 12px;">
                      © ${new Date().getFullYear()} Eon Sign. Todos os direitos reservados.
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
      to: [memberEmail],
      subject: `${adminName} convidou você para ${organizationName}`,
      html: emailHtml,
    });

    console.log("[MEMBER-INVITATION] Email sent:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, message: "Convite enviado com sucesso" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[MEMBER-INVITATION] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
