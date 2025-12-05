import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Truncate name to fit within signature box
const truncateName = (name: string, maxLength: number = 18): string => {
  if (!name) return "";
  if (name.length <= maxLength) return name;
  return name.substring(0, maxLength - 3) + "...";
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
      signerIndex,
      totalSigners,
      signerData,
      isLastSigner
    } = await req.json();

    console.log("Processing simple signature for document:", documentId);
    console.log("Signer index:", signerIndex, "of", totalSigners);
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
    
    // Get the last page for footer signatures
    const lastPage = pages[totalPages - 1];
    const { width, height } = lastPage.getSize();

    // Embed fonts
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Signature box dimensions
    const signatureBoxWidth = 140;
    const signatureBoxHeight = 42;
    const margin = 40;
    const bottomMargin = 30;
    const spacing = 10;

    // Calculate automatic position based on signer index and total signers
    // Layout: Y-shaped for 2 signers (side by side), grid for 3+ signers
    let sigX: number;
    let sigY: number;

    const availableWidth = width - (margin * 2);

    if (totalSigners === 1) {
      // Single signer: center at bottom
      sigX = (width - signatureBoxWidth) / 2;
      sigY = bottomMargin;
    } else if (totalSigners === 2) {
      // 2 signers: Y-layout (side by side)
      const gap = 20;
      const totalWidth = (signatureBoxWidth * 2) + gap;
      const startX = (width - totalWidth) / 2;
      sigX = signerIndex === 0 ? startX : startX + signatureBoxWidth + gap;
      sigY = bottomMargin;
    } else {
      // 3+ signers: grid layout (3 per row)
      const signersPerRow = 3;
      const row = Math.floor(signerIndex / signersPerRow);
      const col = signerIndex % signersPerRow;
      
      const totalRowWidth = (signatureBoxWidth * signersPerRow) + (spacing * (signersPerRow - 1));
      const startX = (width - totalRowWidth) / 2;
      
      sigX = startX + (col * (signatureBoxWidth + spacing));
      sigY = bottomMargin + (row * (signatureBoxHeight + spacing));
    }

    console.log(`Signature position calculated: x=${sigX}, y=${sigY} for signer ${signerIndex + 1}/${totalSigners}`);

    // Draw signature box
    lastPage.drawRectangle({
      x: sigX,
      y: sigY,
      width: signatureBoxWidth,
      height: signatureBoxHeight,
      color: rgb(0.98, 0.98, 0.98),
      borderColor: rgb(0.7, 0.7, 0.7),
      borderWidth: 0.5,
    });

    // Truncate name to fit within box
    const displayName = truncateName(typedSignature || signerData.name, 18);

    // Draw typed signature name
    lastPage.drawText(displayName, {
      x: sigX + 5,
      y: sigY + signatureBoxHeight - 16,
      size: 11,
      font: helveticaBold,
      color: rgb(0.1, 0.1, 0.3),
    });

    // Draw "Assinatura Eletrônica" label
    lastPage.drawText("Assinatura Eletrônica", {
      x: sigX + 5,
      y: sigY + signatureBoxHeight - 28,
      size: 6,
      font: helveticaFont,
      color: rgb(0.4, 0.4, 0.4),
    });

    // Draw signature date
    const signDate = new Date().toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    lastPage.drawText(signDate, {
      x: sigX + 5,
      y: sigY + 5,
      size: 6,
      font: helveticaFont,
      color: rgb(0.4, 0.4, 0.4),
    });

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
