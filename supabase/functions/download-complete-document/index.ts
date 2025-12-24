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

async function mergePdfs(signedPdfBytes: ArrayBuffer, reportPdfBytes: ArrayBuffer): Promise<Uint8Array> {
  const mergedPdf = await PDFDocument.create();
  
  // Load signed document
  const signedDoc = await PDFDocument.load(signedPdfBytes);
  const signedPages = await mergedPdf.copyPages(signedDoc, signedDoc.getPageIndices());
  signedPages.forEach(page => mergedPdf.addPage(page));
  
  // Load report
  const reportDoc = await PDFDocument.load(reportPdfBytes);
  const reportPages = await mergedPdf.copyPages(reportDoc, reportDoc.getPageIndices());
  reportPages.forEach(page => mergedPdf.addPage(page));
  
  return mergedPdf.save();
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

    const isSimpleMode = document.signature_mode === "SIMPLE" || !document.bry_envelope_uuid;
    let mergedPdf: Uint8Array;

    if (!isSimpleMode && document.bry_envelope_uuid && document.bry_document_uuid) {
      // ADVANCED/QUALIFIED mode: Use BRy reportUnified directly
      // The reportUnified already contains: original document + signatures + evidence page
      console.log("Using BRy reportUnified for ADVANCED/QUALIFIED mode (no merge needed)");

      const bryReportResult = await supabase.functions.invoke("bry-download-report", {
        body: { documentId }
      });

      if (bryReportResult.error) {
        throw new Error(`Failed to download BRy report: ${bryReportResult.error.message}`);
      }

      // bry-download-report returns the PDF directly as blob
      const reportBlob = bryReportResult.data;
      if (reportBlob instanceof Blob) {
        const arrayBuffer = await reportBlob.arrayBuffer();
        mergedPdf = new Uint8Array(arrayBuffer);
      } else {
        throw new Error("Unexpected response format from BRy report");
      }
      
      console.log("BRy reportUnified size:", mergedPdf.byteLength, "bytes");
    } else {
      // SIMPLE mode: Merge signed document with local signature report
      console.log("Using local report for SIMPLE mode");

      // Determine signed file path
      const signedFilePath = document.bry_signed_file_url || document.file_url;
      if (!signedFilePath) {
        throw new Error("No signed file available");
      }

      console.log("Downloading signed document from:", signedFilePath);

      // Download signed document
      const { data: signedFileData, error: downloadError } = await supabase.storage
        .from("documents")
        .download(signedFilePath);

      if (downloadError || !signedFileData) {
        throw new Error(`Failed to download signed document: ${downloadError?.message}`);
      }

      const signedPdfBytes = await signedFileData.arrayBuffer();
      console.log("Signed document size:", signedPdfBytes.byteLength, "bytes");

      // Generate local signature report
      const { data: reportResult, error: reportError } = await supabase.functions.invoke(
        "generate-signature-report",
        { body: { documentId } }
      );

      if (reportError || !reportResult?.pdfBytes) {
        throw new Error("Failed to generate signature report");
      }

      const reportPdfBytes = new Uint8Array(reportResult.pdfBytes).buffer;
      console.log("Report size:", reportPdfBytes.byteLength, "bytes");

      // Merge PDFs for SIMPLE mode only
      mergedPdf = await mergePdfs(signedPdfBytes, reportPdfBytes);
      console.log("Merged PDF size:", mergedPdf.byteLength, "bytes");
    }

    const safeFilename = sanitizeFilename(document.name);

    return new Response(
      JSON.stringify({
        pdfBytes: Array.from(mergedPdf),
        fileName: `${safeFilename}_completo.pdf`
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
