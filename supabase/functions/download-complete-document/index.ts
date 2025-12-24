import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Sanitiza nome de arquivo para evitar problemas com caracteres especiais
function sanitizeFilename(filename: string): string {
  return filename
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-zA-Z0-9._-]/g, '_'); // Substitui caracteres especiais por _
}

// Get BRy access token
async function getBryToken(): Promise<string | null> {
  const clientId = Deno.env.get("BRY_CLIENT_ID");
  const clientSecret = Deno.env.get("BRY_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    console.log("BRy credentials not configured");
    return null;
  }

  const authUrl = "https://cloud.bry.com.br/token-service/jwt";

  try {
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
      console.error("Failed to get BRy token:", tokenResponse.status);
      return null;
    }

    const tokenData = await tokenResponse.json();
    return tokenData.access_token;
  } catch (error) {
    console.error("Error getting BRy token:", error);
    return null;
  }
}

// Download BRy reportUnified
async function downloadBryReport(
  envelopeUuid: string,
  documentUuid: string,
  accessToken: string
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

// Merge two PDFs
async function mergeTwoPdfs(signedPdfBytes: ArrayBuffer, reportPdfBytes: ArrayBuffer): Promise<Uint8Array> {
  const mergedPdf = await PDFDocument.create();
  
  const signedDoc = await PDFDocument.load(signedPdfBytes);
  const signedPages = await mergedPdf.copyPages(signedDoc, signedDoc.getPageIndices());
  signedPages.forEach(page => mergedPdf.addPage(page));
  
  const reportDoc = await PDFDocument.load(reportPdfBytes);
  const reportPages = await mergedPdf.copyPages(reportDoc, reportDoc.getPageIndices());
  reportPages.forEach(page => mergedPdf.addPage(page));
  
  return mergedPdf.save();
}

// Merge multiple PDFs into one
async function mergeMultiplePdfs(pdfBuffers: ArrayBuffer[]): Promise<Uint8Array> {
  if (pdfBuffers.length === 0) {
    throw new Error("No PDFs to merge");
  }
  
  if (pdfBuffers.length === 1) {
    return new Uint8Array(pdfBuffers[0]);
  }

  const mergedPdf = await PDFDocument.create();

  for (let i = 0; i < pdfBuffers.length; i++) {
    const doc = await PDFDocument.load(pdfBuffers[i]);
    const pages = await mergedPdf.copyPages(doc, doc.getPageIndices());
    pages.forEach((page) => mergedPdf.addPage(page));
    console.log(`Added ${pages.length} pages from document ${i + 1}`);
  }

  console.log(`Merged ${pdfBuffers.length} PDFs`);
  return mergedPdf.save();
}

// Process a single document and return its complete PDF
async function getDocumentCompletePdf(
  supabase: any,
  document: any,
  bryToken: string | null
): Promise<ArrayBuffer | null> {
  const isSimpleMode = document.signature_mode === "SIMPLE" || !document.bry_envelope_uuid;

  if (isSimpleMode) {
    // SIMPLE mode: download signed doc + merge with local report
    const signedFilePath = document.bry_signed_file_url || document.file_url;
    if (!signedFilePath) {
      console.error(`No file path for document ${document.id}`);
      return null;
    }

    const { data: signedFileData, error: downloadError } = await supabase.storage
      .from("documents")
      .download(signedFilePath);

    if (downloadError || !signedFileData) {
      console.error(`Failed to download signed document ${document.id}:`, downloadError);
      return null;
    }

    const signedPdfBytes = await signedFileData.arrayBuffer();
    console.log(`Document ${document.id} signed PDF: ${signedPdfBytes.byteLength} bytes`);

    // Generate local signature report
    const { data: reportResult, error: reportError } = await supabase.functions.invoke(
      "generate-signature-report",
      { body: { documentId: document.id } }
    );

    if (reportError || !reportResult?.pdfBytes) {
      console.error(`Failed to generate report for document ${document.id}:`, reportError);
      // Return signed document without report
      return signedPdfBytes;
    }

    const reportPdfBytes = new Uint8Array(reportResult.pdfBytes).buffer as ArrayBuffer;
    console.log(`Document ${document.id} report: ${reportPdfBytes.byteLength} bytes`);

    // Merge signed + report
    const mergedPdf = await mergeTwoPdfs(signedPdfBytes, reportPdfBytes);
    const resultBuffer = new ArrayBuffer(mergedPdf.byteLength);
    new Uint8Array(resultBuffer).set(mergedPdf);
    return resultBuffer;
    
  } else if (document.bry_envelope_uuid && document.bry_document_uuid && bryToken) {
    // ADVANCED/QUALIFIED mode: use BRy reportUnified directly
    const reportBuffer = await downloadBryReport(
      document.bry_envelope_uuid,
      document.bry_document_uuid,
      bryToken
    );

    if (reportBuffer) {
      console.log(`Document ${document.id} BRy report: ${reportBuffer.byteLength} bytes`);
      return reportBuffer;
    }
    
    console.error(`Could not download BRy report for document ${document.id}`);
    return null;
  }

  console.error(`Could not process document ${document.id}`);
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentId } = await req.json();
    
    if (!documentId) {
      throw new Error("documentId is required");
    }

    console.log("Downloading complete document for:", documentId);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch document details
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (docError || !document) {
      throw new Error("Document not found");
    }

    // Check if this document belongs to an envelope with multiple documents
    let documentsToProcess: any[] = [document];
    let isEnvelope = false;

    if (document.envelope_id) {
      // Fetch all documents in this envelope
      const { data: envelopeDocuments, error: envError } = await supabase
        .from("documents")
        .select("*")
        .eq("envelope_id", document.envelope_id)
        .order("created_at", { ascending: true });

      if (!envError && envelopeDocuments && envelopeDocuments.length > 1) {
        documentsToProcess = envelopeDocuments;
        isEnvelope = true;
        console.log(`Found ${envelopeDocuments.length} documents in envelope ${document.envelope_id}`);
      }
    }

    // Also check by bry_envelope_uuid for BRy envelopes
    if (!isEnvelope && document.bry_envelope_uuid) {
      const { data: bryEnvelopeDocuments, error: bryError } = await supabase
        .from("documents")
        .select("*")
        .eq("bry_envelope_uuid", document.bry_envelope_uuid)
        .order("created_at", { ascending: true });

      if (!bryError && bryEnvelopeDocuments && bryEnvelopeDocuments.length > 1) {
        documentsToProcess = bryEnvelopeDocuments;
        isEnvelope = true;
        console.log(`Found ${bryEnvelopeDocuments.length} documents with BRy envelope ${document.bry_envelope_uuid}`);
      }
    }

    // Get BRy token once for all documents
    const bryToken = await getBryToken();

    // Process all documents
    const documentPdfs: ArrayBuffer[] = [];

    for (const doc of documentsToProcess) {
      console.log(`Processing document: ${doc.id} (${doc.name})`);
      const pdfBuffer = await getDocumentCompletePdf(supabase, doc, bryToken);
      
      if (pdfBuffer) {
        documentPdfs.push(pdfBuffer);
      } else {
        console.error(`Failed to process document ${doc.id}`);
      }
    }

    if (documentPdfs.length === 0) {
      throw new Error("No documents could be processed");
    }

    // Merge all PDFs
    console.log(`Merging ${documentPdfs.length} document PDFs...`);
    const mergedPdf = await mergeMultiplePdfs(documentPdfs);
    console.log(`Final merged PDF size: ${mergedPdf.byteLength} bytes`);

    // Generate filename
    let safeFilename: string;
    if (isEnvelope && documentsToProcess.length > 1) {
      // Use envelope name or first document name
      const baseName = document.name.split(" - ")[0] || document.name;
      safeFilename = sanitizeFilename(`Envelope_${baseName}`);
    } else {
      safeFilename = sanitizeFilename(document.name);
    }

    return new Response(
      JSON.stringify({
        pdfBytes: Array.from(mergedPdf),
        fileName: `${safeFilename}_completo.pdf`,
        documentsIncluded: documentsToProcess.length,
        isEnvelope: isEnvelope
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error downloading complete document:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
