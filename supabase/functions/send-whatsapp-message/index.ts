import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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

    // Initialize Supabase client for logging
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    let messageBody: string;

    if (isCompleted) {
      // Mensagem para documento completamente assinado
      messageBody = `Olá ${signerName}! 🎉

O documento *${documentName}* foi assinado por todos os signatários! ✅

Você receberá o documento assinado por e-mail.

_Eon Sign - Sistema de Assinatura Digital_`;
    } else {
      // Mensagem para convite de assinatura
      messageBody = `Olá ${signerName}! 👋

*${organizationName}* enviou um documento para você assinar digitalmente.

📄 *Documento:* ${documentName}

Clique no link abaixo para visualizar e assinar:
${signatureUrl}

_Eon Sign - Sistema de Assinatura Digital_`;
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
      
      // Log failed message to database
      const { data: documentData } = await supabase
        .from('documents')
        .select('user_id')
        .eq('id', documentId)
        .single();

      if (documentData) {
        await supabase.from('whatsapp_history').insert({
          user_id: documentData.user_id,
          document_id: documentId,
          recipient_phone: cleanPhone,
          recipient_name: signerName,
          message_type: isCompleted ? 'document_completed' : 'signature_invitation',
          message_sid: result.sid || null,
          status: 'failed',
          error_code: result.error_code,
          error_message: result.error_message,
        });
      }

      throw new Error(`Twilio error: ${result.error_message}`);
    }

    console.log("WhatsApp message sent successfully:", result.sid);

    // Log successful message to database
    const { data: documentData } = await supabase
      .from('documents')
      .select('user_id')
      .eq('id', documentId)
      .single();

    if (documentData) {
      await supabase.from('whatsapp_history').insert({
        user_id: documentData.user_id,
        document_id: documentId,
        recipient_phone: cleanPhone,
        recipient_name: signerName,
        message_type: isCompleted ? 'document_completed' : 'signature_invitation',
        message_sid: result.sid,
        status: 'sent',
      });
    }

    return new Response(JSON.stringify({ success: true, sid: result.sid }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending WhatsApp message:", error);
    
    // Try to log the error to database if we have the necessary info
    try {
      const { signerName, signerPhone, documentId } = await req.json();
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const { data: documentData } = await supabase
        .from('documents')
        .select('user_id')
        .eq('id', documentId)
        .single();

      if (documentData) {
        let cleanPhone = signerPhone.replace(/\D/g, "");
        if (!cleanPhone.startsWith("55")) {
          cleanPhone = "55" + cleanPhone;
        }

        await supabase.from('whatsapp_history').insert({
          user_id: documentData.user_id,
          document_id: documentId,
          recipient_phone: cleanPhone,
          recipient_name: signerName,
          message_type: 'signature_invitation',
          status: 'failed',
          error_message: error.message,
        });
      }
    } catch (logError) {
      console.error("Error logging to database:", logError);
    }
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
