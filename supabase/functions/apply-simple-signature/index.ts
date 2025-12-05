import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      documentId,
      signerId,
      typedSignature,
      signatureX,
      signatureY,
      signaturePage,
      signerData,
      allSignersData,
      isLastSigner
    } = await req.json();

    console.log("Processing simple signature for document:", documentId);
    console.log("Is last signer:", isLastSigner);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get document info including bry_signed_file_url for accumulated signatures
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("file_url, bry_signed_file_url, name, user_id")
      .eq("id", documentId)
      .single();

    if (docError || !document) {
      console.error("Document not found:", docError);
      return new Response(
        JSON.stringify({ error: "Documento não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get company settings for logo
    const { data: companySettings } = await supabase
      .from("company_settings")
      .select("logo_url, company_name")
      .eq("user_id", document.user_id)
      .single();

    // Determine which PDF to use: already signed version or original
    const sourceUrl = document.bry_signed_file_url || document.file_url;
    console.log("Source URL for signature:", sourceUrl);

    // Extract file path from URL
    let filePath: string;
    if (sourceUrl.includes('/documents/')) {
      const urlParts = sourceUrl.split('/documents/');
      filePath = decodeURIComponent(urlParts[urlParts.length - 1].split('?')[0]);
    } else {
      filePath = sourceUrl;
    }

    console.log("Downloading PDF from storage path:", filePath);

    // Download PDF via Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("documents")
      .download(filePath);

    if (downloadError || !fileData) {
      console.error("Error downloading PDF:", downloadError);
      return new Response(
        JSON.stringify({ error: "Erro ao baixar PDF" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pdfBytes = await fileData.arrayBuffer();
    console.log("PDF downloaded, size:", pdfBytes.byteLength);

    // Load the PDF
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const totalPages = pages.length;
    
    // Get the page for signature
    const pageIndex = Math.min(Math.max(0, (signaturePage || totalPages) - 1), totalPages - 1);
    const page = pages[pageIndex];
    const { width, height } = page.getSize();

    // Embed fonts
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Calculate signature position with offset for multiple signers at default position
    let adjustedSignatureY = signatureY;
    
    // If using default position (92% or higher), offset based on signer index to avoid overlap
    if (signatureY >= 90 && allSignersData && allSignersData.length > 1) {
      const signerIndex = allSignersData.findIndex((s: any) => s.id === signerId);
      if (signerIndex > 0) {
        // Move each subsequent signer's signature 8% up from the previous
        adjustedSignatureY = signatureY - (signerIndex * 8);
        console.log(`Signer index ${signerIndex}: adjusted Y from ${signatureY} to ${adjustedSignatureY}`);
      }
    }
    
    const sigX = signatureX ? (signatureX / 100) * width : 50;
    const sigY = adjustedSignatureY ? height - ((adjustedSignatureY / 100) * height) : height - 200;

    // Draw signature box - reduced size
    const signatureBoxWidth = 150;
    const signatureBoxHeight = 45;
    
    page.drawRectangle({
      x: sigX,
      y: sigY - signatureBoxHeight,
      width: signatureBoxWidth,
      height: signatureBoxHeight,
      color: rgb(0.98, 0.98, 0.98),
      borderColor: rgb(0.7, 0.7, 0.7),
      borderWidth: 0.5,
    });

    // Draw typed signature - reduced size
    page.drawText(typedSignature || signerData.name, {
      x: sigX + 5,
      y: sigY - 18,
      size: 12,
      font: helveticaBold,
      color: rgb(0.1, 0.1, 0.3),
    });

    page.drawText("Assinatura Eletronica", {
      x: sigX + 5,
      y: sigY - 30,
      size: 6,
      font: helveticaFont,
      color: rgb(0.4, 0.4, 0.4),
    });

    const signDate = new Date().toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    page.drawText(signDate, {
      x: sigX + 5,
      y: sigY - 40,
      size: 6,
      font: helveticaFont,
      color: rgb(0.4, 0.4, 0.4),
    });

    // Note: Validation page is now generated separately by generate-signature-report edge function
    // and merged with the signed document when sending completion emails

    // Save the modified PDF
    const modifiedPdfBytes = await pdfDoc.save();

    // Upload to storage
    const timestamp = Date.now();
    const sanitizedName = document.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9.-]/g, "_");
    const signedFilePath = `${document.user_id}/signed/${timestamp}-${sanitizedName}_assinado.pdf`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(signedFilePath, modifiedPdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("Error uploading signed PDF:", uploadError);
      throw new Error("Erro ao salvar documento assinado");
    }

    console.log("Signed PDF uploaded to:", signedFilePath);

    return new Response(
      JSON.stringify({
        success: true,
        signedFilePath: signedFilePath,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in apply-simple-signature:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
