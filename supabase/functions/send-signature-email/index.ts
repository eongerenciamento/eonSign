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

interface SignatureEmailRequest {
  signerName: string;
  signerEmail: string;
  documentName: string;
  documentId: string;
  senderName: string;
  organizationName: string;
  userId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { signerName, signerEmail, documentName, documentId, senderName, organizationName, userId }: SignatureEmailRequest = await req.json();

    console.log("Sending signature email to:", signerEmail);

    const supabase = createClient(supabaseUrl, supabaseKey);

    // URL para página de assinatura - usa APP_URL configurável
    const APP_URL = Deno.env.get("APP_URL") || "https://lbyoniuealghclfuahko.lovable.app";
    const signatureUrl = `${APP_URL}/assinar/${documentId}`;
    const BANNER_URL = `${supabaseUrl}/storage/v1/object/public/email-assets/header-banner.png`;

    const emailResponse = await resend.emails.send({
      from: "Eon Sign <noreply@eongerenciamento.com.br>",
      to: [signerEmail],
      subject: `Você tem um documento para assinar - ${documentName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="padding: 0; text-align: center;">
            <img src="${BANNER_URL}" alt="Éon Sign" style="width: 100%; max-width: 600px; display: block; margin: 0 auto;" />
          </div>
          <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #273d60;">Olá, ${signerName || 'Signatário'}!</h2>
            <p style="color: #333; font-size: 16px;">
              <strong>${organizationName}</strong> enviou um documento para você assinar digitalmente.
            </p>
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #666;"><strong>Documento:</strong> ${documentName}</p>
            </div>
            <p style="color: #333; font-size: 14px;">
              Clique no botão abaixo para visualizar e assinar o documento. 
              Você precisará informar seu CPF/CNPJ para concluir a assinatura.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${signatureUrl}" 
                 style="background: linear-gradient(135deg, #273d60, #001a4d); 
                        color: white; 
                        padding: 15px 40px; 
                        text-decoration: none; 
                        border-radius: 8px;
                        font-weight: bold;
                        display: inline-block;">
                Assinar Documento
              </a>
            </div>
            <p style="color: #999; font-size: 12px; text-align: center;">
              Se o botão não funcionar, copie e cole este link no seu navegador:<br>
              <a href="${signatureUrl}" style="color: #273d60;">${signatureUrl}</a>
            </p>
          </div>
          <div style="background: #f9f9f9; padding: 20px; text-align: center;">
            <p style="color: #6b7280; margin: 0; font-size: 12px;">
              © ${new Date().getFullYear()} Éon Sign - Sistema de Gestão de Documentos e Assinatura Digital
            </p>
          </div>
        </div>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    // Salvar no histórico
    await supabase.from('email_history').insert({
      user_id: userId,
      recipient_email: signerEmail,
      subject: `Você tem um documento para assinar - ${documentName}`,
      email_type: 'signature_invitation',
      document_id: documentId,
      status: 'sent'
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
        await supabase.from('email_history').insert({
          user_id: body.userId,
          recipient_email: body.signerEmail,
          subject: `Você tem um documento para assinar - ${body.documentName || 'Documento'}`,
          email_type: 'signature_invitation',
          document_id: body.documentId,
          status: 'failed',
          error_message: error.message
        });
      }
    } catch (historyError) {
      console.error("Error saving to history:", historyError);
    }
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);