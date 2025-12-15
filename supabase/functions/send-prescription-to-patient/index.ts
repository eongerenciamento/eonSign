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

interface PrescriptionRequest {
  documentId: string;
  documentName: string;
  patientName: string;
  patientPhone: string | null;
  patientEmail: string | null;
  organizationName: string;
  senderName: string;
  userId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      documentId, 
      documentName, 
      patientName, 
      patientPhone, 
      patientEmail, 
      organizationName, 
      senderName,
      userId 
    }: PrescriptionRequest = await req.json();

    console.log("[PRESCRIPTION] Sending prescription to patient:", { patientName, patientEmail, patientPhone });

    const supabase = createClient(supabaseUrl, supabaseKey);
    const APP_URL = Deno.env.get("APP_URL") || "https://sign.eonhub.com.br";
    const BANNER_URL = `${supabaseUrl}/storage/v1/object/public/email-assets/header-banner.png`;

    // Get the signed document URL
    const { data: docData, error: docError } = await supabase
      .from('documents')
      .select('bry_signed_file_url, file_url')
      .eq('id', documentId)
      .single();

    if (docError) {
      console.error("[PRESCRIPTION] Error fetching document:", docError);
      throw new Error("Documento não encontrado");
    }

    // Use signed URL if available, otherwise original
    const documentUrl = docData.bry_signed_file_url || docData.file_url;
    const validationUrl = `${APP_URL}/validar/${documentId}`;

    let emailSent = false;
    let whatsappSent = false;

    // Send email if patient has email
    if (patientEmail) {
      try {
        // Download the PDF to attach
        let pdfAttachment = null;
        if (documentUrl) {
          try {
            const pdfResponse = await fetch(documentUrl);
            if (pdfResponse.ok) {
              const pdfBuffer = await pdfResponse.arrayBuffer();
              const pdfBase64 = btoa(new Uint8Array(pdfBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
              pdfAttachment = {
                filename: `${documentName}.pdf`,
                content: pdfBase64
              };
            }
          } catch (pdfErr) {
            console.error("[PRESCRIPTION] Error downloading PDF for attachment:", pdfErr);
          }
        }

        const emailPayload: any = {
          from: "Eon Sign <noreply@eonhub.com.br>",
          to: [patientEmail],
          subject: `Sua Prescrição Médica - ${documentName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="padding: 0; text-align: center;">
                <img src="${BANNER_URL}" alt="Eon Sign" style="width: 100%; max-width: 600px; display: block; margin: 0 auto;" />
              </div>
              <div style="padding: 30px; background: #f9f9f9;">
                <h2 style="color: #273d60;">Olá, ${patientName}!</h2>
                <p style="color: #333; font-size: 16px;">
                  ${senderName} de <strong>${organizationName}</strong> enviou uma prescrição médica para você.
                </p>
                <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #7c3aed;">
                  <p style="margin: 0; color: #666;"><strong>Documento:</strong> ${documentName}</p>
                  <p style="margin: 10px 0 0 0; color: #7c3aed; font-weight: bold;">📋 Prescrição Médica Assinada Digitalmente</p>
                </div>
                <p style="color: #333; font-size: 14px;">
                  O documento está anexado a este e-mail e também pode ser acessado pelo link abaixo:
                </p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${validationUrl}" 
                     style="background: linear-gradient(135deg, #273d60, #001a4d); 
                            color: white; 
                            padding: 15px 40px; 
                            text-decoration: none; 
                            border-radius: 8px;
                            font-weight: bold;
                            display: inline-block;">
                    Visualizar Prescrição
                  </a>
                </div>
                <p style="color: #999; font-size: 12px; text-align: center;">
                  Este documento foi assinado digitalmente com Certificado ICP-Brasil.<br>
                  Para verificar a autenticidade, acesse o link acima.
                </p>
              </div>
              <div style="background: #f9f9f9; padding: 20px; text-align: center;">
                <p style="color: #6b7280; margin: 0; font-size: 12px;">
                  © ${new Date().getFullYear()} Eon Sign - Sistema de Gestão de Documentos e Assinatura Digital
                </p>
              </div>
            </div>
          `,
        };

        if (pdfAttachment) {
          emailPayload.attachments = [pdfAttachment];
        }

        const emailResponse = await resend.emails.send(emailPayload);
        console.log("[PRESCRIPTION] Email sent successfully:", emailResponse);
        emailSent = true;

        // Save to email history
        await supabase.from('email_history').insert({
          user_id: userId,
          recipient_email: patientEmail,
          subject: `Sua Prescrição Médica - ${documentName}`,
          email_type: 'prescription_delivery',
          document_id: documentId,
          status: 'sent'
        });

      } catch (emailErr: any) {
        console.error("[PRESCRIPTION] Error sending email:", emailErr);
        await supabase.from('email_history').insert({
          user_id: userId,
          recipient_email: patientEmail,
          subject: `Sua Prescrição Médica - ${documentName}`,
          email_type: 'prescription_delivery',
          document_id: documentId,
          status: 'failed',
          error_message: emailErr.message
        });
      }
    }

    // Send WhatsApp if patient has phone
    if (patientPhone) {
      try {
        // Format phone for Twilio
        const cleanPhone = patientPhone.replace(/\D/g, '');
        const formattedPhone = cleanPhone.startsWith('55') ? `+${cleanPhone}` : `+55${cleanPhone}`;
        
        const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
        const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
        const TWILIO_WHATSAPP_NUMBER = Deno.env.get("TWILIO_WHATSAPP_NUMBER");
        const TEMPLATE_COMPLETED = Deno.env.get("TWILIO_TEMPLATE_COMPLETED");

        if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_WHATSAPP_NUMBER && TEMPLATE_COMPLETED) {
          const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
          const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

          // Use completion template for prescription delivery
          const contentVariables = JSON.stringify({
            "1": patientName || "Paciente",
            "2": documentName
          });

          const formData = new URLSearchParams();
          formData.append("To", `whatsapp:${formattedPhone}`);
          formData.append("From", `whatsapp:${TWILIO_WHATSAPP_NUMBER}`);
          formData.append("ContentSid", TEMPLATE_COMPLETED);
          formData.append("ContentVariables", contentVariables);

          const twilioResponse = await fetch(twilioUrl, {
            method: "POST",
            headers: {
              "Authorization": `Basic ${auth}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: formData.toString(),
          });

          const twilioData = await twilioResponse.json();

          if (twilioResponse.ok) {
            console.log("[PRESCRIPTION] WhatsApp sent successfully:", twilioData.sid);
            whatsappSent = true;

            // Save to WhatsApp history
            await supabase.from('whatsapp_history').insert({
              user_id: userId,
              document_id: documentId,
              recipient_name: patientName,
              recipient_phone: patientPhone,
              message_type: 'prescription_delivery',
              message_sid: twilioData.sid,
              status: 'sent'
            });
          } else {
            console.error("[PRESCRIPTION] Twilio error:", twilioData);
            await supabase.from('whatsapp_history').insert({
              user_id: userId,
              document_id: documentId,
              recipient_name: patientName,
              recipient_phone: patientPhone,
              message_type: 'prescription_delivery',
              status: 'failed',
              error_code: twilioData.code?.toString(),
              error_message: twilioData.message
            });
          }
        } else {
          console.log("[PRESCRIPTION] WhatsApp credentials not configured");
        }

      } catch (whatsappErr: any) {
        console.error("[PRESCRIPTION] Error sending WhatsApp:", whatsappErr);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailSent, 
        whatsappSent,
        message: emailSent || whatsappSent ? "Prescrição enviada com sucesso" : "Nenhum canal de envio disponível"
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("[PRESCRIPTION] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);