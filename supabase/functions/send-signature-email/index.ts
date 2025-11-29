import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { signerName, signerEmail, documentName, documentId, senderName }: SignatureEmailRequest = await req.json();

    console.log("Sending signature email to:", signerEmail);

    // URL para página de assinatura - usa APP_URL configurável
    const APP_URL = Deno.env.get("APP_URL") || "https://lbyoniuealghclfuahko.lovable.app";
    const signatureUrl = `${APP_URL}/assinar/${documentId}`;

    const emailResponse = await resend.emails.send({
      from: "Éon Sign <noreply@eongerenciamento.com.br>",
      to: [signerEmail],
      subject: `Você tem um documento para assinar - ${documentName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #273d60, #001a4d); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">Éon Sign</h1>
          </div>
          <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #273d60;">Olá, ${signerName || 'Signatário'}!</h2>
            <p style="color: #333; font-size: 16px;">
              <strong>${senderName}</strong> enviou um documento para você assinar digitalmente.
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
          <div style="background: #273d60; padding: 20px; text-align: center;">
            <p style="color: white; margin: 0; font-size: 12px;">
              © 2024 Éon Sign - Sistema de Gestão de Documentos e Assinatura Digital
            </p>
          </div>
        </div>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);