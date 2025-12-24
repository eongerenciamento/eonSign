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
  documentIds?: string[]; // Array para múltiplos documentos (envelope)
  documentName: string;
  signerEmails: string[];
  senderName: string;
}

// Get BRy access token using correct Cloud authentication
async function getBryToken(): Promise<string | null> {
  const clientId = Deno.env.get("BRY_CLIENT_ID");
  const clientSecret = Deno.env.get("BRY_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    console.log("BRy credentials not configured");
    return null;
  }

  const authUrl = "https://cloud.bry.com.br/token-service/jwt";

  try {
    console.log("[BRy Auth] Requesting token from:", authUrl);
    
    const basicAuth = btoa(`${clientId}:${clientSecret}`);

    const tokenResponse = await fetch(authUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${basicAuth}`,
      },
      body: "grant_type=client_credentials",
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Failed to get BRy token:", tokenResponse.status, errorText);
      return null;
    }

    const tokenData = await tokenResponse.json();
    console.log("BRy token obtained successfully");
    return tokenData.access_token;
  } catch (error) {
    console.error("Error getting BRy token:", error);
    return null;
  }
}

// Download BRy evidence report (reportUnified)
async function downloadBryReport(
  envelopeUuid: string,
  documentUuid: string,
  accessToken: string,
): Promise<ArrayBuffer | null> {
  const bryEnvironment = Deno.env.get("BRY_ENVIRONMENT") || "homologation";
  const apiBaseUrl =
    bryEnvironment === "production" ? "https://easysign.bry.com.br" : "https://easysign.hom.bry.com.br";

  try {
    const reportUrl = `${apiBaseUrl}/api/service/sign/v1/signatures/${envelopeUuid}/documents/${documentUuid}/reportUnified`;
    console.log("Downloading BRy report from:", reportUrl);

    const response = await fetch(reportUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/pdf",
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
    console.log("Generating local signature report for document:", documentId);

    const response = await fetch(`${supabaseUrl}/functions/v1/generate-signature-report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseKey}`,
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
async function mergeTwoPdfs(pdf1Buffer: ArrayBuffer, pdf2Buffer: ArrayBuffer): Promise<ArrayBuffer> {
  const mergedPdf = await PDFDocument.create();

  const doc1 = await PDFDocument.load(pdf1Buffer);
  const pages1 = await mergedPdf.copyPages(doc1, doc1.getPageIndices());
  pages1.forEach((page) => mergedPdf.addPage(page));

  const doc2 = await PDFDocument.load(pdf2Buffer);
  const pages2 = await mergedPdf.copyPages(doc2, doc2.getPageIndices());
  pages2.forEach((page) => mergedPdf.addPage(page));

  const mergedBytes = await mergedPdf.save();
  const result = new ArrayBuffer(mergedBytes.length);
  new Uint8Array(result).set(mergedBytes);
  return result;
}

// Merge multiple PDFs into one unified document
async function mergeMultiplePdfs(pdfBuffers: ArrayBuffer[]): Promise<ArrayBuffer> {
  if (pdfBuffers.length === 0) {
    throw new Error("No PDFs to merge");
  }
  
  if (pdfBuffers.length === 1) {
    return pdfBuffers[0];
  }

  const mergedPdf = await PDFDocument.create();

  for (let i = 0; i < pdfBuffers.length; i++) {
    const doc = await PDFDocument.load(pdfBuffers[i]);
    const pages = await mergedPdf.copyPages(doc, doc.getPageIndices());
    pages.forEach((page) => mergedPdf.addPage(page));
    console.log(`Added ${pages.length} pages from document ${i + 1}`);
  }

  const mergedBytes = await mergedPdf.save();
  const result = new ArrayBuffer(mergedBytes.length);
  new Uint8Array(result).set(mergedBytes);
  
  console.log(`Merged ${pdfBuffers.length} PDFs into ${mergedBytes.length} bytes`);
  return result;
}

// Convert ArrayBuffer to base64 safely
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

// Process a single document and return its complete PDF
async function getDocumentCompletePdf(
  supabase: any,
  documentId: string,
  bryToken: string | null
): Promise<{ buffer: ArrayBuffer; name: string } | null> {
  const { data: document, error: docError } = await supabase
    .from("documents")
    .select("id, name, file_url, user_id, bry_envelope_uuid, bry_document_uuid, bry_signed_file_url, signature_mode")
    .eq("id", documentId)
    .single();

  if (docError || !document) {
    console.error(`Document ${documentId} not found`);
    return null;
  }

  const isSimpleMode = document.signature_mode === "SIMPLE" || !document.bry_envelope_uuid;

  if (isSimpleMode) {
    // SIMPLE mode: download signed doc + merge with local report
    let filePath: string;
    if (document.bry_signed_file_url) {
      if (document.bry_signed_file_url.includes("/documents/")) {
        const urlParts = document.bry_signed_file_url.split("/documents/");
        filePath = decodeURIComponent(urlParts[urlParts.length - 1].split("?")[0]);
      } else {
        filePath = document.bry_signed_file_url;
      }
    } else if (document.file_url) {
      const urlParts = document.file_url.split("/documents/");
      filePath = decodeURIComponent(urlParts[urlParts.length - 1].split("?")[0]);
    } else {
      console.error(`No file URL for document ${documentId}`);
      return null;
    }

    const { data: fileData, error: fileError } = await supabase.storage.from("documents").download(filePath);
    if (fileError || !fileData) {
      console.error(`Error downloading document ${documentId}:`, fileError);
      return null;
    }

    const signedPdfBuffer = await fileData.arrayBuffer();
    const localReportBuffer = await generateLocalReport(documentId);

    if (localReportBuffer) {
      const mergedBuffer = await mergeTwoPdfs(signedPdfBuffer, localReportBuffer);
      return { buffer: mergedBuffer, name: document.name };
    }
    
    return { buffer: signedPdfBuffer, name: document.name };
  } else if (document.bry_envelope_uuid && document.bry_document_uuid && bryToken) {
    // ADVANCED/QUALIFIED mode: use BRy reportUnified directly
    const reportBuffer = await downloadBryReport(
      document.bry_envelope_uuid,
      document.bry_document_uuid,
      bryToken
    );

    if (reportBuffer) {
      return { buffer: reportBuffer, name: document.name };
    }
    
    console.error(`Could not download BRy report for document ${documentId}`);
    return null;
  }

  console.error(`Could not process document ${documentId}`);
  return null;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentId, documentIds, documentName, signerEmails, senderName }: DocumentCompletedEmailRequest = await req.json();

    // Determinar quais documentos processar
    const idsToProcess = documentIds && documentIds.length > 0 ? documentIds : [documentId];
    
    console.log(`Processing ${idsToProcess.length} documents for completed email`);
    console.log("Document IDs:", idsToProcess);

    let APP_URL = Deno.env.get("APP_URL") || "https://sign.eonhub.com.br";
    if (APP_URL && !APP_URL.startsWith("http")) {
      APP_URL = `https://${APP_URL}`;
    }
    
    const BANNER_URL = `${supabaseUrl}/storage/v1/object/public/email-assets/header-banner.png`;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get BRy token once for all documents
    const bryToken = await getBryToken();

    // Process all documents and collect their PDFs
    const documentPdfs: ArrayBuffer[] = [];
    let firstUserId: string | null = null;

    for (const docId of idsToProcess) {
      console.log(`Processing document: ${docId}`);
      
      const result = await getDocumentCompletePdf(supabase, docId, bryToken);
      
      if (result) {
        documentPdfs.push(result.buffer);
        console.log(`Document ${docId} (${result.name}): ${result.buffer.byteLength} bytes`);
        
        // Get user_id from first document for email history
        if (!firstUserId) {
          const { data: doc } = await supabase.from("documents").select("user_id").eq("id", docId).single();
          firstUserId = doc?.user_id;
        }
      } else {
        console.error(`Failed to process document ${docId}`);
      }
    }

    if (documentPdfs.length === 0) {
      throw new Error("Nenhum documento pôde ser processado");
    }

    // Merge all document PDFs into one
    console.log(`Merging ${documentPdfs.length} document PDFs...`);
    const finalPdfBuffer = await mergeMultiplePdfs(documentPdfs);
    console.log(`Final merged PDF size: ${finalPdfBuffer.byteLength} bytes`);

    const base64Content = arrayBufferToBase64(finalPdfBuffer);
    const attachmentFilename = idsToProcess.length > 1 
      ? `${documentName}_envelope_completo.pdf`
      : `${documentName}_completo.pdf`;

    // Prepare recipients
    const recipients = signerEmails;
    console.log("Sending emails to:", recipients);

    // Send email to each signatory
    const emailPromises = recipients.map(async (email) => {
      const documentCount = idsToProcess.length > 1 
        ? `<br><strong>Documentos no envelope:</strong> ${idsToProcess.length}`
        : '';
        
      return await resend.emails.send({
        from: "eonSign <noreply@eonhub.com.br>",
        to: [email],
        subject: `Documento Assinado - ${documentName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="padding: 0; text-align: center;">
              <img src="${BANNER_URL}" alt="eonSign" style="width: 100%; max-width: 600px; display: block; margin: 0 auto;" />
            </div>
            <div style="padding: 30px; background: #f9f9f9;">
              <h2 style="color: #273d60;">Documento Assinado com Sucesso!</h2>
              <p style="color: #333; font-size: 16px;">
                O documento <strong>${documentName}</strong> foi assinado por todos os signatários.
              </p>
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; color: #666;">
                  <strong>Documento:</strong> ${documentName}${documentCount}<br>
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
                © ${new Date().getFullYear()} eonSign - Sistema de Gestão de Documentos e Assinatura Digital
              </p>
            </div>
          </div>
        `,
        attachments: [
          {
            filename: attachmentFilename,
            content: base64Content,
          },
        ],
      });
    });

    const results = await Promise.allSettled(emailPromises);

    // Save to email history (using first document ID for reference)
    if (firstUserId) {
      const historyPromises = recipients.map(async (email, index) => {
        const result = results[index];
        return supabase.from("email_history").insert({
          user_id: firstUserId,
          recipient_email: email,
          subject: `Documento Assinado - ${documentName}`,
          email_type: "document_completed",
          document_id: documentId,
          status: result.status === "fulfilled" ? "sent" : "failed",
          error_message: result.status === "rejected" ? String(result.reason) : null,
        });
      });

      await Promise.allSettled(historyPromises);
    }

    // Log results
    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        console.log(`Email sent successfully to ${recipients[index]}`);
      } else {
        console.error(`Error sending email to ${recipients[index]}:`, result.reason);
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        sent: results.filter((r) => r.status === "fulfilled").length,
        total: results.length,
        documentsProcessed: documentPdfs.length,
        totalDocuments: idsToProcess.length,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (error: any) {
    console.error("Error sending document completed email:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
