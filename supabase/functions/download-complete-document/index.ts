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

    // Generate signature report
    const { data: reportResult, error: reportError } = await supabase.functions.invoke(
      "generate-signature-report",
      { body: { documentId } }
    );

    if (reportError || !reportResult?.pdfBytes) {
      throw new Error("Failed to generate signature report");
    }

    const reportPdfBytes = new Uint8Array(reportResult.pdfBytes).buffer;
    console.log("Report size:", reportPdfBytes.byteLength, "bytes");

    // Merge PDFs
    const mergedPdf = await mergePdfs(signedPdfBytes, reportPdfBytes);
    console.log("Merged PDF size:", mergedPdf.byteLength, "bytes");

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
