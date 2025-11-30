import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-twilio-signature",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Twilio envia dados como form-urlencoded
    const formData = await req.formData();
    
    const messageSid = formData.get("MessageSid");
    const messageStatus = formData.get("MessageStatus");
    const to = formData.get("To");
    const from = formData.get("From");
    const errorCode = formData.get("ErrorCode");
    const errorMessage = formData.get("ErrorMessage");

    console.log("Twilio Webhook received:", {
      messageSid,
      messageStatus,
      to,
      from,
      errorCode,
      errorMessage,
      timestamp: new Date().toISOString()
    });

    // Update message status in database
    if (messageSid) {
      const updateData: any = {
        status: messageStatus,
      };

      if (messageStatus === "delivered") {
        updateData.delivered_at = new Date().toISOString();
      }

      if (messageStatus === "read") {
        updateData.read_at = new Date().toISOString();
      }

      if (messageStatus === "failed" || messageStatus === "undelivered") {
        updateData.error_code = errorCode;
        updateData.error_message = errorMessage;
      }

      const { error: updateError } = await supabase
        .from('whatsapp_history')
        .update(updateData)
        .eq('message_sid', messageSid);

      if (updateError) {
        console.error("Error updating WhatsApp history:", updateError);
      } else {
        console.log(`WhatsApp history updated for message ${messageSid} with status ${messageStatus}`);
      }
    }

    // Tratamento especial para falhas
    if (messageStatus === "failed" || messageStatus === "undelivered") {
      console.error(`WhatsApp message failed: ${errorCode} - ${errorMessage}`);
    }

    // Log de sucesso para mensagens entregues
    if (messageStatus === "delivered") {
      console.log(`WhatsApp message delivered successfully: ${messageSid}`);
    }

    if (messageStatus === "read") {
      console.log(`WhatsApp message read by recipient: ${messageSid}`);
    }

    // Twilio espera resposta 200 para confirmar recebimento
    return new Response("OK", {
      status: 200,
      headers: { "Content-Type": "text/plain", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error processing Twilio webhook:", error);
    // Retornar 200 mesmo em erro para Twilio não retentar indefinidamente
    return new Response("OK", {
      status: 200,
      headers: { "Content-Type": "text/plain", ...corsHeaders },
    });
  }
};

serve(handler);
