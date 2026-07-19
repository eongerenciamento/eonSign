import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { renderEmailShell, renderActionButton } from "../_shared/email-template.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WEBHOOK_URL = "https://beyefodsuuftviwthdfe.supabase.co/functions/v1/user-webhook";

async function sendMemberWebhook(payload: object): Promise<void> {
  const apiKey = Deno.env.get("EONSIGN_WEBHOOK_API_KEY");
  
  if (!apiKey) {
    console.log("[MEMBER-INVITATION] Webhook API key not configured, skipping");
    return;
  }

  try {
    console.log("[MEMBER-INVITATION] Sending webhook:", JSON.stringify(payload));
    
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[MEMBER-INVITATION] Webhook failed:", response.status, errorText);
    } else {
      console.log("[MEMBER-INVITATION] Webhook sent successfully");
    }
  } catch (error) {
    console.error("[MEMBER-INVITATION] Error sending webhook:", error);
  }
}

interface InvitationRequest {
  memberEmail: string;
  organizationId: string;
}

// Generate a secure random token
function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Generate a temporary password
function generateTempPassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
  let password = '';
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[MEMBER-INVITATION] Function started");

    const supabaseClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "");

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

    // Get authenticated user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser(token);

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

    const normalizedEmail = memberEmail.toLowerCase().trim();
    console.log("[MEMBER-INVITATION] Inviting member:", normalizedEmail);

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

    // Get organization's stripe_customer_id
    const { data: subscriptionData } = await supabaseAdmin
      .from("user_subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", organizationId)
      .eq("status", "active")
      .single();

    const organizationStripeId = subscriptionData?.stripe_customer_id || null;

    // Check if member already exists
    const { data: existingMember } = await supabaseAdmin
      .from("organization_members")
      .select("id, status")
      .eq("organization_id", organizationId)
      .eq("member_email", normalizedEmail)
      .single();

    if (existingMember) {
      if (existingMember.status === "active") {
        throw new Error("Este membro já faz parte da organização");
      }
      // If pending, we'll update the existing record with a new token
    }

    // Check if user already exists in auth
    const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = usersData?.users?.find(u => u.email === normalizedEmail);

    let userId: string;
    let memberId: string;

    if (existingUser) {
      userId = existingUser.id;
      console.log("[MEMBER-INVITATION] User already exists:", userId);
    } else {
      // Create user with temporary password
      const tempPassword = generateTempPassword();
      const { data: newUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password: tempPassword,
        email_confirm: false, // Will be confirmed when they set their password
      });

      if (createUserError) {
        console.error("[MEMBER-INVITATION] Error creating user:", createUserError);
        throw new Error("Erro ao criar conta do usuário");
      }

      userId = newUser.user.id;
      console.log("[MEMBER-INVITATION] User created:", userId);
    }

    // Generate invitation token
    const invitationToken = generateToken();
    const tokenExpiresAt = new Date();
    tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 7); // Token expires in 7 days

    // Create or update member record
    if (existingMember) {
      memberId = existingMember.id;
      const { error: updateError } = await supabaseAdmin
        .from("organization_members")
        .update({
          invitation_token: invitationToken,
          token_expires_at: tokenExpiresAt.toISOString(),
          invited_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingMember.id);

      if (updateError) {
        console.error("[MEMBER-INVITATION] Update error:", updateError);
        throw new Error("Erro ao atualizar convite");
      }
    } else {
      const { data: newMember, error: insertError } = await supabaseAdmin
        .from("organization_members")
        .insert({
          organization_id: organizationId,
          member_email: normalizedEmail,
          member_user_id: userId,
          role: "member",
          status: "pending",
          invitation_token: invitationToken,
          token_expires_at: tokenExpiresAt.toISOString(),
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("[MEMBER-INVITATION] Insert error:", insertError);
        throw new Error("Erro ao criar convite");
      }
      
      memberId = newMember.id;
    }

    console.log("[MEMBER-INVITATION] Member record created/updated with token");

    // Send invitation email
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const appUrl = Deno.env.get("APP_URL") || "https://sign.eonhub.com.br";
    
    const setPasswordUrl = `${appUrl}/definir-senha?email=${encodeURIComponent(normalizedEmail)}&token=${invitationToken}`;
    const bannerUrl = `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/email-assets/header-banner-v2.png`;

    const contentHtml = `
      <h2 style="color:#273d60; margin-top:0; font-size:20px;">Você foi convidado!</h2>
      <p style="color:#333; font-size:14px;">Olá,</p>
      <p style="color:#333; font-size:14px;">
        <strong>${adminName}</strong> convidou você para fazer parte da organização <strong>${organizationName}</strong> no eonSign.
      </p>
      <p style="color:#333; font-size:14px;">
        Como membro da organização, você terá acesso à plataforma utilizando a assinatura da empresa, sem custos adicionais.
      </p>
      <p style="color:#333; font-size:14px;">
        Clique no botão abaixo para definir sua senha e acessar o sistema:
      </p>
      ${renderActionButton(setPasswordUrl, "Definir Senha")}
      <p style="color:#666; font-size:12px;">
        Este link expira em 7 dias. Se você não esperava este convite, pode ignorar este e-mail.
      </p>
      <p style="color:#999; font-size:12px;">
        Se o botão não funcionar, copie e cole este link no seu navegador:<br>
        <a href="${setPasswordUrl}" style="color:#273d60; word-break:break-all;">${setPasswordUrl}</a>
      </p>
    `;

    const emailHtml = renderEmailShell(contentHtml, { bannerUrl });

    const emailResponse = await resend.emails.send({
      from: "eonSign <noreply@eonhub.com.br>",
      to: [normalizedEmail],
      subject: `${adminName} convidou você para ${organizationName}`,
      html: emailHtml,
    });

    console.log("[MEMBER-INVITATION] Email sent:", emailResponse);

    // Send webhook notification for new member (only for new members, not re-invites)
    if (!existingMember) {
      const webhookPayload: any = {
        event: "user.created",
        system_name: "eonsign",
        user: {
          external_id: memberId,
          name: normalizedEmail.split("@")[0],
          email: normalizedEmail,
          role: "Usuário",
        },
      };

      // Add organization_stripe_id if available
      if (organizationStripeId) {
        webhookPayload.user.organization_stripe_id = organizationStripeId;
      }

      await sendMemberWebhook(webhookPayload);
    }

    return new Response(JSON.stringify({ success: true, message: "Convite enviado com sucesso" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[MEMBER-INVITATION] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
