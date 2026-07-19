import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";
import { renderEmailShell, renderActionButton } from "../_shared/email-template.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SignatureEmailRequest {
  signerName: string;
  signerEmail: string;
  documentName: string;
  documentId: string;
  senderName: string;
  organizationName: string;
  userId: string;
  brySignerLink?: string; // Link da BRy se disponível
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      signerName,
      signerEmail,
      documentName,
      documentId,
      senderName,
      organizationName,
      userId,
      brySignerLink,
    }: SignatureEmailRequest = await req.json();

    console.log("Sending signature email to:", signerEmail);
    console.log("BRy link provided:", brySignerLink ? "Yes" : "No");

    const supabase = createClient(supabaseUrl, supabaseKey);

    // URL para página de assinatura - usa link BRy se disponível, senão link interno
    let APP_URL = Deno.env.get("APP_URL") || "https://sign.eonhub.com.br";
    // Garantir que tenha https://
    if (APP_URL && !APP_URL.startsWith("http")) {
      APP_URL = `https://${APP_URL}`;
    }
    
    // Se não foi fornecido brySignerLink, verificar se é documento ADVANCED/QUALIFIED e buscar do banco
    let finalBrySignerLink = brySignerLink;
    if (!finalBrySignerLink && documentId) {
      console.log("BRy link not provided, checking document signature mode...");
      
      const { data: docData, error: docError } = await supabase
        .from('documents')
        .select('signature_mode, bry_envelope_uuid')
        .eq('id', documentId)
        .single();
      
      if (docError) {
        console.error("Error fetching document:", docError);
      } else if (docData?.signature_mode && docData.signature_mode !== 'SIMPLE' && docData.bry_envelope_uuid) {
        console.log(`Document is ${docData.signature_mode}, fetching BRy link from database...`);
        
        const { data: signerData, error: signerError } = await supabase
          .from('document_signers')
          .select('bry_signer_link')
          .eq('document_id', documentId)
          .eq('email', signerEmail)
          .single();
        
        if (signerError) {
          console.error("Error fetching signer link:", signerError);
        } else if (signerData?.bry_signer_link) {
          finalBrySignerLink = signerData.bry_signer_link;
          console.log("Found BRy link in database:", finalBrySignerLink);
        } else {
          console.warn("WARNING: Document is ADVANCED/QUALIFIED but no BRy link found in database!");
        }
      }
    }
    
    const signatureUrl = finalBrySignerLink || `${APP_URL}/assinar/${documentId}`;
    console.log("[DEBUG] Final signature URL:", signatureUrl);
    const BANNER_URL = `${supabaseUrl}/storage/v1/object/public/email-assets/header-banner-v2.png`;

    // Texto diferente se for BRy
    const isBrySignature = !!finalBrySignerLink;
    const instructionText = isBrySignature
      ? "Clique no botão abaixo para visualizar e assinar o documento digitalmente com certificado ICP-Brasil."
      : "Clique no botão abaixo para visualizar e assinar o documento.";

    const contentHtml = `
      <h2 style="color:#273d60; margin-top:0; font-size:20px;">Olá, ${signerName || "Signatário"}!</h2>
      <p style="color:#333; font-size:14px;">
        <strong>${organizationName}</strong> enviou um documento para você assinar digitalmente.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:white; border-radius:8px; margin:20px 0;">
        <tr><td style="padding:16px;">
          <p style="margin:0; color:#333; font-size:14px;"><strong>Documento:</strong> ${documentName}</p>
        </td></tr>
      </table>
      <p style="color:#333; font-size:14px;">${instructionText}</p>
      ${renderActionButton(signatureUrl, "Assinar Documento")}
      <p style="color:#666; font-size:12px; text-align:center;">
        Se o botão não funcionar, copie e cole este link no seu navegador:<br>
        <a href="${signatureUrl}" style="color:#273d60;">${signatureUrl}</a>
      </p>
    `;

    const emailResponse = await resend.emails.send({
      from: "eonSign <noreply@eonhub.com.br>",
      to: [signerEmail],
      subject: `Você tem um documento para assinar - ${documentName}`,
      html: renderEmailShell(contentHtml, { bannerUrl: BANNER_URL }),
    });

    console.log("Email sent successfully:", emailResponse);

    // Salvar no histórico
    await supabase.from("email_history").insert({
      user_id: userId,
      recipient_email: signerEmail,
      subject: `Você tem um documento para assinar - ${documentName}`,
      email_type: "signature_invitation",
      document_id: documentId,
      status: "sent",
    });

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending email:", error);

    // Salvar erro no histórico se tivermos as informações necessárias
    try {
      const body = await req.clone().json();
      if (body.userId && body.signerEmail) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        await supabase.from("email_history").insert({
          user_id: body.userId,
          recipient_email: body.signerEmail,
          subject: `Você tem um documento para assinar - ${body.documentName || "Documento"}`,
          email_type: "signature_invitation",
          document_id: body.documentId,
          status: "failed",
          error_message: error.message,
        });
      }
    } catch (historyError) {
      console.error("Error saving to history:", historyError);
    }

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
