import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { renderEmailShell } from "../_shared/email-template.ts";

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    // Filter only pending signers
    const pendingSigners = signers.filter(s => s.status === "pending");
    console.log("Pending signers to notify:", pendingSigners.length);

    const emailResults: any[] = [];
    const whatsappResults: any[] = [];

    for (const signer of pendingSigners) {
      // Send cancellation email
      try {
        console.log("Sending cancellation email to:", signer.email);
        
        const bannerUrl = `${supabaseUrl}/storage/v1/object/public/email-assets/header-banner-v2.png`;
        const contentHtml = `
          <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:16px; margin-bottom:20px; text-align:center;">
            <h2 style="color:#dc2626; margin:0; font-size:18px;">Documento Cancelado</h2>
          </div>
          <p style="color:#333; font-size:14px; margin:0 0 12px 0;">
            Olá <strong>${signer.name}</strong>,
          </p>
          <p style="color:#333; font-size:14px; margin:0 0 12px 0;">
            O documento <strong>"${documentName}"</strong> foi cancelado pelo remetente${senderName ? ` (${senderName})` : ''} e não está mais disponível para assinatura.
          </p>
          <p style="color:#666; font-size:12px; margin:0;">
            Qualquer link de assinatura associado a este documento não será mais válido.
          </p>
        `;

        const emailResponse = await resend.emails.send({
          from: "eonSign <noreply@eonhub.com.br>",
          to: [signer.email],
          subject: `Documento cancelado - ${documentName}`,
          html: renderEmailShell(contentHtml, { bannerUrl }),
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
