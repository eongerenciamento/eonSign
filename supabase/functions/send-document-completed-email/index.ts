import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";

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

// Get BRy access token
async function getBryToken(): Promise<string | null> {
  const clientId = Deno.env.get("BRY_CLIENT_ID");
  const clientSecret = Deno.env.get("BRY_CLIENT_SECRET");
  const bryEnvironment = Deno.env.get("BRY_ENVIRONMENT") || "homologation";
  
  if (!clientId || !clientSecret) {
    console.log("BRy credentials not configured");
    return null;
  }

  const apiBaseUrl = bryEnvironment === "production" 
    ? "https://easysign.bry.com.br" 
    : "https://easysign.hom.bry.com.br";

  try {
    const tokenResponse = await fetch(`${apiBaseUrl}/api/service/token-service/jwt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, clientSecret }),
    });

    if (!tokenResponse.ok) {
      console.error("Failed to get BRy token:", tokenResponse.status);
      return null;
    }

    const tokenData = await tokenResponse.json();
    return tokenData.accessToken;
  } catch (error) {
    console.error("Error getting BRy token:", error);
    return null;
  }
}

// Download BRy evidence report
async function downloadBryReport(
  envelopeUuid: string, 
  documentUuid: string, 
  accessToken: string
): Promise<ArrayBuffer | null> {
  const bryEnvironment = Deno.env.get("BRY_ENVIRONMENT") || "homologation";
  const apiBaseUrl = bryEnvironment === "production" 
    ? "https://easysign.bry.com.br" 
    : "https://easysign.hom.bry.com.br";

  try {
    const reportUrl = `${apiBaseUrl}/api/service/sign/v1/signatures/${envelopeUuid}/documents/${documentUuid}/reportUnified`;
    console.log("Downloading BRy report from:", reportUrl);

    const response = await fetch(reportUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/pdf",
      },
    });

    if (!response.ok) {
      console.error("Failed to download BRy report:", response.status);
      return null;
    }

    return await response.arrayBuffer();
  } catch (error) {
    console.error("Error downloading BRy report:", error);
    return null;
  }
}

// Generate local signature report for SIMPLE mode
async function generateLocalReport(documentId: string): Promise<ArrayBuffer | null> {
  try {
    console.log("Generating local signature report for SIMPLE mode...");
    
    const response = await fetch(`${supabaseUrl}/functions/v1/generate-signature-report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ documentId }),
    });

    if (!response.ok) {
      console.error("Failed to generate local report:", response.status);
      return null;
    }

    const data = await response.json();
    if (data.error) {
      console.error("Error in local report generation:", data.error);
      return null;
    }

    // Convert pdfBytes array back to ArrayBuffer
    if (data.pdfBytes) {
      const uint8Array = new Uint8Array(data.pdfBytes);
      return uint8Array.buffer;
    }

    return null;
  } catch (error) {
    console.error("Error generating local report:", error);
    return null;
  }
}

// Merge two PDFs into one
async function mergePdfs(signedPdfBuffer: ArrayBuffer, reportPdfBuffer: ArrayBuffer): Promise<ArrayBuffer> {
  const mergedPdf = await PDFDocument.create();
  
  // Load signed document
  const signedDoc = await PDFDocument.load(signedPdfBuffer);
  const signedPages = await mergedPdf.copyPages(signedDoc, signedDoc.getPageIndices());
  signedPages.forEach(page => mergedPdf.addPage(page));
  
  // Load evidence report
  const reportDoc = await PDFDocument.load(reportPdfBuffer);
  const reportPages = await mergedPdf.copyPages(reportDoc, reportDoc.getPageIndices());
  reportPages.forEach(page => mergedPdf.addPage(page));
  
  // Save merged PDF and copy to new ArrayBuffer
  const mergedBytes = await mergedPdf.save();
  const result = new ArrayBuffer(mergedBytes.length);
  new Uint8Array(result).set(mergedBytes);
  return result;
}

// Convert ArrayBuffer to base64 safely
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000; // 32KB chunks to avoid stack overflow
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentId, documentName, signerEmails, senderName }: DocumentCompletedEmailRequest = await req.json();

    console.log("Sending document completed email for document:", documentId);

    const APP_URL = Deno.env.get("APP_URL") || "https://sign.eonhub.com.br";
    const BANNER_URL = `${supabaseUrl}/storage/v1/object/public/email-assets/header-banner.png`;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch document from database including signature_mode
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('file_url, user_id, bry_envelope_uuid, bry_document_uuid, bry_signed_file_url, signature_mode')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      throw new Error("Documento não encontrado");
    }

    // Determine file path - prefer signed file if available
    let filePath: string;
    if (document.bry_signed_file_url) {
      // bry_signed_file_url can be either a full URL or just a path
      if (document.bry_signed_file_url.includes('/documents/')) {
        // It's a full URL, extract the path
        const urlParts = document.bry_signed_file_url.split('/documents/');
        filePath = decodeURIComponent(urlParts[urlParts.length - 1].split('?')[0]);
      } else {
        // It's already a path
        filePath = document.bry_signed_file_url;
      }
    } else if (document.file_url) {
      const urlParts = document.file_url.split('/documents/');
      filePath = decodeURIComponent(urlParts[urlParts.length - 1].split('?')[0]);
    } else {
      throw new Error("URL do documento não encontrada");
    }
    
    // Download signed document from Storage
    console.log("Downloading signed document from path:", filePath);
    const { data: fileData, error: fileError } = await supabase
      .storage
      .from('documents')
      .download(filePath);

    if (fileError || !fileData) {
      console.error("Error downloading document:", fileError);
      throw new Error("Erro ao baixar o documento assinado");
    }

    const signedPdfBuffer = await fileData.arrayBuffer();
    console.log(`Signed document size: ${signedPdfBuffer.byteLength} bytes`);

    // Determine which report to use based on signature_mode
    let finalPdfBuffer: ArrayBuffer = signedPdfBuffer;
    let attachmentFilename = `${documentName}.pdf`;
    const isSimpleMode = document.signature_mode === "SIMPLE" || !document.bry_envelope_uuid;

    if (isSimpleMode) {
      // SIMPLE mode: Generate local report
      console.log("Using local report generation for SIMPLE signature mode");
      const localReportBuffer = await generateLocalReport(documentId);
      
      if (localReportBuffer) {
        console.log(`Local report size: ${localReportBuffer.byteLength} bytes`);
        try {
          finalPdfBuffer = await mergePdfs(signedPdfBuffer, localReportBuffer);
          attachmentFilename = `${documentName}_completo.pdf`;
          console.log(`Merged PDF size: ${finalPdfBuffer.byteLength} bytes`);
        } catch (mergeError) {
          console.error("Error merging PDFs, using signed document only:", mergeError);
        }
      } else {
        console.log("Could not generate local report, sending signed document only");
      }
    } else if (document.bry_envelope_uuid && document.bry_document_uuid) {
      // ADVANCED/QUALIFIED mode: Use BRy report
      console.log("Using BRy report for ADVANCED/QUALIFIED signature mode");
      
      const bryToken = await getBryToken();
      if (bryToken) {
        const reportPdfBuffer = await downloadBryReport(
          document.bry_envelope_uuid,
          document.bry_document_uuid,
          bryToken
        );

        if (reportPdfBuffer) {
          console.log(`BRy report size: ${reportPdfBuffer.byteLength} bytes`);
          try {
            finalPdfBuffer = await mergePdfs(signedPdfBuffer, reportPdfBuffer);
            attachmentFilename = `${documentName}_completo.pdf`;
            console.log(`Merged PDF size: ${finalPdfBuffer.byteLength} bytes`);
          } catch (mergeError) {
            console.error("Error merging PDFs, using signed document only:", mergeError);
          }
        } else {
          console.log("Could not download BRy report, sending signed document only");
        }
      } else {
        console.log("Could not get BRy token, sending signed document only");
      }
    } else {
      console.log("No BRy envelope/document UUID and not SIMPLE mode, sending signed document only");
    }

    const base64Content = arrayBufferToBase64(finalPdfBuffer);
    console.log(`Base64 conversion successful, length: ${base64Content.length}`);

    // Prepare recipients
    const recipients = signerEmails;
    console.log("Sending emails to:", recipients);

    // Send email to each signatory
    const emailPromises = recipients.map(async (email) => {
      return await resend.emails.send({
        from: "Eon Sign <noreply@eonhub.com.br>",
        to: [email],
        subject: `Documento Assinado - ${documentName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="padding: 0; text-align: center;">
              <img src="${BANNER_URL}" alt="Eon Sign" style="width: 100%; max-width: 600px; display: block; margin: 0 auto;" />
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
                O documento assinado está anexado a este e-mail junto com o relatório de evidências contendo todas as assinaturas e dados de validação. Você também pode visualizá-lo no sistema a qualquer momento.
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
                  Acessar Eon Drive
                </a>
              </div>
              <p style="color: #999; font-size: 12px; text-align: center;">
                Este documento possui validade legal e todas as assinaturas foram registradas com evidências de autenticação.
              </p>
            </div>
            <div style="background: #f9f9f9; padding: 20px; text-align: center;">
              <p style="color: #6b7280; margin: 0; font-size: 12px;">
                © ${new Date().getFullYear()} Eon Sign - Sistema de Gestão de Documentos e Assinatura Digital
              </p>
            </div>
          </div>
        `,
        attachments: [
          {
            filename: attachmentFilename,
            content: base64Content,
          }
        ]
      });
    });

    const results = await Promise.allSettled(emailPromises);
    
    // Save to email history
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
    
    // Log results
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
      total: results.length,
      merged: attachmentFilename.includes('_completo'),
      reportType: isSimpleMode ? 'local' : 'bry'
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
