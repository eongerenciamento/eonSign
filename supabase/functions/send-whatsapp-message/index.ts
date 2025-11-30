import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WhatsAppMessageRequest {
  signerName: string;
  signerPhone: string;
  documentName: string;
  documentId: string;
  organizationName: string;
  isCompleted?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { signerName, signerPhone, documentName, documentId, organizationName, isCompleted }: WhatsAppMessageRequest = await req.json();

    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const fromNumber = Deno.env.get("TWILIO_WHATSAPP_NUMBER");
    const APP_URL = Deno.env.get("APP_URL") || "https://sign.eongerenciamento.com.br";

    if (!accountSid || !authToken || !fromNumber) {
      console.error("Twilio credentials not configured");
      throw new Error("Twilio credentials not configured");
    }

    // Formatar número para WhatsApp (remover formatação e adicionar código do país se necessário)
    let cleanPhone = signerPhone.replace(/\D/g, "");
    if (!cleanPhone.startsWith("55")) {
      cleanPhone = "55" + cleanPhone;
    }

    console.log(`Sending WhatsApp to ${cleanPhone} for document ${documentId}`);

    const signatureUrl = `${APP_URL}/assinar/${documentId}`;
    const driveUrl = `${APP_URL}/drive`;

    let messageBody: string;

    if (isCompleted) {
      // Mensagem para documento completamente assinado
      messageBody = `Olá ${signerName}! 🎉

O documento *${documentName}* foi assinado por todos os signatários! ✅

Você receberá o documento assinado por e-mail e também pode acessá-lo a qualquer momento no sistema:
${driveUrl}

_Éon Sign - Sistema de Assinatura Digital_`;
    } else {
      // Mensagem para convite de assinatura
      messageBody = `Olá ${signerName}! 👋

*${organizationName}* enviou um documento para você assinar digitalmente.

📄 *Documento:* ${documentName}

Clique no link abaixo para visualizar e assinar:
${signatureUrl}

_Éon Sign - Sistema de Assinatura Digital_`;
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const credentials = btoa(`${accountSid}:${authToken}`);

    const body = new URLSearchParams({
      To: `whatsapp:+${cleanPhone}`,
      From: `whatsapp:${fromNumber}`,
      Body: messageBody,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${credentials}`,
      },
      body: body.toString(),
    });

    const result = await response.json();

    if (result.error_code) {
      console.error("Twilio error:", result.error_message);
      throw new Error(`Twilio error: ${result.error_message}`);
    }

    console.log("WhatsApp message sent successfully:", result.sid);

    return new Response(JSON.stringify({ success: true, sid: result.sid }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending WhatsApp message:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
