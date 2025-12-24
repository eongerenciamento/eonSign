import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Signer {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
}

interface RequestBody {
  documentId: string;
  documentName: string;
  signers: Signer[];
  senderName?: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-document-cancelled function called");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentId, documentName, signers, senderName }: RequestBody = await req.json();
    
    console.log("Processing cancellation for document:", documentId, "with signers:", signers?.length);

    if (!documentId || !documentName || !signers || signers.length === 0) {
      console.log("Missing required fields");
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const appUrl = Deno.env.get("APP_URL") || "https://app.eonsign.com.br";

    // Filter only pending signers
    const pendingSigners = signers.filter(s => s.status === "pending");
    console.log("Pending signers to notify:", pendingSigners.length);

    const emailResults: any[] = [];
    const whatsappResults: any[] = [];

    for (const signer of pendingSigners) {
      // Send cancellation email
      try {
        console.log("Sending cancellation email to:", signer.email);
        
        const emailResponse = await resend.emails.send({
          from: "EON Sign <noreply@eonsign.com.br>",
          to: [signer.email],
          subject: `Documento cancelado - ${documentName}`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <img src="${appUrl}/email-assets/eon-sign-logo.png" alt="EON Sign" style="max-width: 150px; height: auto;">
              </div>
              
              <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 30px; border-radius: 12px; margin-bottom: 30px;">
                <h1 style="color: white; margin: 0; font-size: 24px; text-align: center;">
                  Documento Cancelado
                </h1>
              </div>
              
              <div style="background: #f9fafb; padding: 25px; border-radius: 12px; margin-bottom: 25px;">
                <p style="margin: 0 0 15px 0; font-size: 16px;">
                  Olá <strong>${signer.name}</strong>,
                </p>
                <p style="margin: 0 0 15px 0;">
                  O documento <strong>"${documentName}"</strong> foi cancelado pelo remetente${senderName ? ` (${senderName})` : ''} e não está mais disponível para assinatura.
                </p>
                <p style="margin: 0; color: #666;">
                  Qualquer link de assinatura associado a este documento não será mais válido.
                </p>
              </div>
              
              <div style="text-align: center; padding: 20px; border-top: 1px solid #eee; margin-top: 30px;">
                <p style="color: #888; font-size: 12px; margin: 0;">
                  Este é um e-mail automático enviado pela plataforma EON Sign.
                </p>
              </div>
            </body>
            </html>
          `,
        });

        console.log("Email sent successfully to:", signer.email);
        emailResults.push({ email: signer.email, success: true, response: emailResponse });

        // Log to email_history
        const { data: docData } = await supabase
          .from("documents")
          .select("user_id")
          .eq("id", documentId)
          .single();

        if (docData?.user_id) {
          await supabase.from("email_history").insert({
            user_id: docData.user_id,
            document_id: documentId,
            recipient_email: signer.email,
            email_type: "document_cancelled",
            subject: `Documento cancelado - ${documentName}`,
            status: "sent",
          });
        }
      } catch (emailError: any) {
        console.error("Error sending email to:", signer.email, emailError);
        emailResults.push({ email: signer.email, success: false, error: emailError.message });
      }

      // Send WhatsApp notification if phone is available
      if (signer.phone) {
        try {
          const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
          const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
          const twilioWhatsappNumber = Deno.env.get("TWILIO_WHATSAPP_NUMBER");
          const twilioTemplateCancelled = Deno.env.get("TWILIO_TEMPLATE_CANCELLED");

          if (twilioAccountSid && twilioAuthToken && twilioWhatsappNumber && twilioTemplateCancelled) {
            console.log("Sending WhatsApp cancellation to:", signer.phone);
            
            // Normalize phone number
            let normalizedPhone = signer.phone.replace(/\D/g, "");
            if (!normalizedPhone.startsWith("55")) {
              normalizedPhone = "55" + normalizedPhone;
            }

            const formData = new URLSearchParams();
            formData.append("To", `whatsapp:+${normalizedPhone}`);
            formData.append("From", `whatsapp:${twilioWhatsappNumber}`);
            formData.append("ContentSid", twilioTemplateCancelled);
            formData.append("ContentVariables", JSON.stringify({
              "1": signer.name,
              "2": documentName
            }));

            const twilioResponse = await fetch(
              `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
                  Authorization: `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
                },
                body: formData.toString(),
              }
            );

            const twilioData = await twilioResponse.json();
            console.log("WhatsApp response:", twilioData);
            whatsappResults.push({ phone: signer.phone, success: twilioResponse.ok, response: twilioData });

            // Log to whatsapp_history
            const { data: docData } = await supabase
              .from("documents")
              .select("user_id")
              .eq("id", documentId)
              .single();

            if (docData?.user_id) {
              await supabase.from("whatsapp_history").insert({
                user_id: docData.user_id,
                document_id: documentId,
                recipient_phone: normalizedPhone,
                recipient_name: signer.name,
                message_type: "document_cancelled",
                message_sid: twilioData.sid,
                status: twilioResponse.ok ? "sent" : "failed",
                error_message: twilioResponse.ok ? null : twilioData.message,
              });
            }
          } else {
            console.log("WhatsApp template for cancellation not configured, skipping");
          }
        } catch (whatsappError: any) {
          console.error("Error sending WhatsApp to:", signer.phone, whatsappError);
          whatsappResults.push({ phone: signer.phone, success: false, error: whatsappError.message });
        }
      }
    }

    console.log("Cancellation notifications completed. Emails:", emailResults.length, "WhatsApp:", whatsappResults.length);

    return new Response(
      JSON.stringify({ 
        success: true, 
        emailResults, 
        whatsappResults,
        message: `Notificações enviadas para ${pendingSigners.length} signatário(s)` 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-document-cancelled:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
