import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to remove accents and special characters for PDF compatibility
const normalizeText = (text: string | null): string => {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove combining diacritical marks
    .replace(/[^\x00-\x7F]/g, ""); // Remove any remaining non-ASCII characters
};

// Get display name without truncation
const getDisplayName = (name: string): string => {
  if (!name) return "";
  return normalizeText(name);
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

    // Get display name (full name, no truncation)
    const displayName = getDisplayName(typedSignature || signerData.name);
    
    // Adjust font size based on name length
    let nameFontSize = 9;
    if (displayName.length > 40) {
      nameFontSize = 7;
    } else if (displayName.length > 30) {
      nameFontSize = 8;
    }
    
    // Signature box dimensions
    const signatureBoxHeight = 42;
    const margin = 40;
    const bottomMargin = 30;
    const gap = 10;

    // Calculate available width and divide equally among all signers
    const availableWidth = width - (margin * 2);
    const maxSignersPerRow = 4; // Maximum signers per row
    const signersInRow = Math.min(totalSigners, maxSignersPerRow);
    const totalGapWidth = (signersInRow - 1) * gap;
    const widthPerSigner = (availableWidth - totalGapWidth) / signersInRow;

    // Calculate position based on fixed slots (not dynamic width)
    const row = Math.floor(signerIndex / maxSignersPerRow);
    const col = signerIndex % maxSignersPerRow;
    
    const sigX = margin + (col * (widthPerSigner + gap));
    const sigY = bottomMargin + (row * (signatureBoxHeight + gap));

    console.log(`Signature position: x=${sigX}, y=${sigY} for signer ${signerIndex + 1}/${totalSigners}, name: ${displayName}`);

    // Draw typed signature name - dynamic font size, gray700
    lastPage.drawText(displayName, {
      x: sigX,
      y: sigY + signatureBoxHeight - 12,
      size: nameFontSize,
      font: helveticaBold,
      color: rgb(0.22, 0.25, 0.32), // gray700
    });

    // Draw "Assinado Eletronicamente" label - gray600
    lastPage.drawText("Assinado Eletronicamente", {
      x: sigX,
      y: sigY + signatureBoxHeight - 22,
      size: 6,
      font: helveticaFont,
      color: rgb(0.29, 0.33, 0.39), // gray600
    });

    // Draw signature date - gray500
    const signDate = new Date().toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    lastPage.drawText(signDate, {
      x: sigX,
      y: sigY + signatureBoxHeight - 32,
      size: 6,
      font: helveticaFont,
      color: rgb(0.42, 0.45, 0.50), // gray500
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
