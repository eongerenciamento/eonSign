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
  brySignerLink?: string; // Link da BRy se disponível
  validationUrl?: string; // Link de validação/download para documento completado
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { signerName, signerPhone, documentName, documentId, organizationName, isCompleted, brySignerLink, validationUrl }: WhatsAppMessageRequest = await req.json();

    // Initialize Supabase client for logging
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const fromNumber = Deno.env.get("TWILIO_WHATSAPP_NUMBER");
    const templateInvitation = Deno.env.get("TWILIO_TEMPLATE_INVITATION");
    const templateCompleted = Deno.env.get("TWILIO_TEMPLATE_COMPLETED");
    const APP_URL = Deno.env.get("APP_URL") || "https://sign.eonhub.com.br";

    if (!accountSid || !authToken || !fromNumber) {
      console.error("Twilio credentials not configured");
      throw new Error("Twilio credentials not configured");
    }

    if (!templateInvitation || !templateCompleted) {
      console.error("WhatsApp templates not configured");
      throw new Error("WhatsApp templates not configured");
    }

    // Formatar número para WhatsApp (remover formatação e adicionar código do país se necessário)
    let cleanPhone = signerPhone.replace(/\D/g, "");
    if (!cleanPhone.startsWith("55")) {
      cleanPhone = "55" + cleanPhone;
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
        
        // Buscar pelo telefone do signatário
        let cleanPhoneForQuery = signerPhone.replace(/\D/g, "");
        
        const { data: signerData, error: signerError } = await supabase
          .from('document_signers')
          .select('bry_signer_link, phone')
          .eq('document_id', documentId);
        
        if (signerError) {
          console.error("Error fetching signer link:", signerError);
        } else if (signerData && signerData.length > 0) {
          // Encontrar o signatário pelo telefone (comparar últimos 8-9 dígitos)
          const matchingSigner = signerData.find(s => {
            const signerCleanPhone = s.phone?.replace(/\D/g, "") || "";
            return signerCleanPhone.endsWith(cleanPhoneForQuery.slice(-8)) || 
                   cleanPhoneForQuery.endsWith(signerCleanPhone.slice(-8));
          });
          
          if (matchingSigner?.bry_signer_link) {
            finalBrySignerLink = matchingSigner.bry_signer_link;
            console.log("Found BRy link in database:", finalBrySignerLink);
          } else {
            console.warn("WARNING: Document is ADVANCED/QUALIFIED but no BRy link found for this signer!");
          }
        }
      }
    }
    
    // Usar link BRy se disponível, senão link interno
    const signatureUrl = finalBrySignerLink || `${APP_URL}/assinar/${documentId}`;
    console.log(`Using signature URL: ${signatureUrl}`);
    console.log(`BRy link provided: ${finalBrySignerLink ? 'Yes (from DB or param)' : 'No - using system link'}`);

    const templateSid = isCompleted ? templateCompleted : templateInvitation;
    const templateType = isCompleted ? "document_completed" : "signature_invitation";

    console.log(`Sending WhatsApp to ${cleanPhone} for document ${documentId} using template ${templateType} (${templateSid})`);

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const credentials = btoa(`${accountSid}:${authToken}`);

    let body: URLSearchParams;

    if (isCompleted) {
      // Template de documento completamente assinado COM LINK
      const downloadLink = validationUrl || `${APP_URL}/validar/${documentId}`;
      console.log(`Using download link for completed template: ${downloadLink}`);
      
      body = new URLSearchParams({
        To: `whatsapp:+${cleanPhone}`,
        From: `whatsapp:${fromNumber}`,
        ContentSid: templateSid,
        ContentVariables: JSON.stringify({
          "1": signerName,     // {{1}} - Nome do signatário
          "2": documentName,   // {{2}} - Nome do documento
          "3": downloadLink    // {{3}} - Link para validar/download
        }),
      });
    } else {
      // Template de convite de assinatura
      body = new URLSearchParams({
        To: `whatsapp:+${cleanPhone}`,
        From: `whatsapp:${fromNumber}`,
        ContentSid: templateSid,
        ContentVariables: JSON.stringify({
          "1": signerName,        // {{1}} - Nome do signatário
          "2": organizationName,  // {{2}} - Nome da empresa
          "3": documentName,      // {{3}} - Nome do documento
          "4": signatureUrl       // {{4}} - Link para assinar (BRy ou interno)
        }),
      });
    }

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
