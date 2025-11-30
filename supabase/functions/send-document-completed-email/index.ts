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

interface DocumentCompletedEmailRequest {
  documentId: string;
  documentName: string;
  signerEmails: string[];
  senderName: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentId, documentName, signerEmails, senderName }: DocumentCompletedEmailRequest = await req.json();

    console.log("Sending document completed email for document:", documentId);

    const APP_URL = Deno.env.get("APP_URL") || "https://lbyoniuealghclfuahko.lovable.app";
    const BANNER_URL = `${supabaseUrl}/storage/v1/object/public/email-assets/header-banner.png`;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar o documento do Storage
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('file_url, user_id')
      .eq('id', documentId)
      .single();

    if (docError || !document?.file_url) {
      throw new Error("Documento não encontrado");
    }

    // Extrair o caminho do arquivo
    const filePath = document.file_url.split('/documents/')[1];
    
    // Baixar o arquivo do Storage
    const { data: fileData, error: fileError } = await supabase
      .storage
      .from('documents')
      .download(filePath);

    if (fileError || !fileData) {
      throw new Error("Erro ao baixar o documento");
    }

    // Função auxiliar para converter Uint8Array para base64 de forma segura
    function uint8ArrayToBase64(bytes: Uint8Array): string {
      let binary = '';
      const chunkSize = 0x8000; // 32KB chunks para evitar stack overflow
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
      }
      return btoa(binary);
    }

    // Converter o arquivo para base64
    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    
    console.log(`File size: ${buffer.length} bytes`);
    const base64Content = uint8ArrayToBase64(buffer);
    console.log(`Base64 conversion successful, length: ${base64Content.length}`);

    // Preparar lista de destinatários (todos os signatários)
    const recipients = signerEmails;

    console.log("Sending emails to:", recipients);

    // Enviar email para cada signatário
    const emailPromises = recipients.map(async (email) => {
      return await resend.emails.send({
        from: "Eon Gerenciamento <noreply@eongerenciamento.com.br>",
        to: [email],
        subject: `Documento Assinado - ${documentName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #273d60, #001a4d); padding: 0; text-align: center;">
              <img src="${BANNER_URL}" alt="Éon Sign" style="width: 100%; max-width: 600px; display: block;" />
            </div>
            <div style="padding: 30px; background: #f9f9f9;">
              <h2 style="color: #273d60;">Documento Assinado com Sucesso!</h2>
              <p style="color: #333; font-size: 16px;">
                O documento <strong>${documentName}</strong> foi assinado por todos os signatários.
              </p>
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; color: #666;">
                  <strong>Documento:</strong> ${documentName}<br>
                  <strong>Enviado por:</strong> ${senderName}<br>
                  <strong>Status:</strong> <span style="color: #16a34a; font-weight: bold;">✓ Assinado</span>
                </p>
              </div>
              <p style="color: #333; font-size: 14px;">
                O documento assinado está anexado a este e-mail com todas as assinaturas e localizações registradas. Você também pode visualizá-lo no sistema a qualquer momento.
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${APP_URL}/drive" 
                   style="background: linear-gradient(135deg, #273d60, #001a4d); 
                          color: white; 
                          padding: 15px 40px; 
                          text-decoration: none; 
                          border-radius: 8px;
                          font-weight: bold;
                          display: inline-block;">
                  Acessar Éon Drive
                </a>
              </div>
              <p style="color: #999; font-size: 12px; text-align: center;">
                Este documento possui validade legal e todas as assinaturas foram registradas.
              </p>
            </div>
            <div style="background: #f9f9f9; padding: 20px; text-align: center;">
              <p style="color: #6b7280; margin: 0; font-size: 12px;">
                © ${new Date().getFullYear()} Éon Sign - Sistema de Gestão de Documentos e Assinatura Digital
              </p>
            </div>
          </div>
        `,
        attachments: [
          {
            filename: `${documentName}.pdf`,
            content: base64Content,
          }
        ]
      });
    });

    const results = await Promise.allSettled(emailPromises);
    
    // Salvar no histórico
    const historyPromises = recipients.map(async (email, index) => {
      const result = results[index];
      return supabase.from('email_history').insert({
        user_id: document.user_id,
        recipient_email: email,
        subject: `Documento Assinado - ${documentName}`,
        email_type: 'document_completed',
        document_id: documentId,
        status: result.status === 'fulfilled' ? 'sent' : 'failed',
        error_message: result.status === 'rejected' ? String(result.reason) : null
      });
    });

    await Promise.allSettled(historyPromises);
    
    // Log dos resultados
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        console.log(`Email sent successfully to ${recipients[index]}`);
      } else {
        console.error(`Error sending email to ${recipients[index]}:`, result.reason);
      }
    });

    return new Response(JSON.stringify({ 
      success: true,
      sent: results.filter(r => r.status === 'fulfilled').length,
      total: results.length
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending document completed email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
