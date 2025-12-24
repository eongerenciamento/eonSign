import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts, degrees } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to remove accents and special characters for PDF compatibility
const normalizeText = (text: string | null): string => {
  if (!text) return "";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x00-\x7F]/g, "");
};

// Format CPF for display
const formatCPF = (cpf: string | null): string => {
  if (!cpf) return "";
  const cleaned = cpf.replace(/\D/g, "");
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (cleaned.length === 14) {
    return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return cpf;
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
    console.log("Signer data:", JSON.stringify(signerData));

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(
      supabaseUrl,
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

    console.log("Page dimensions:", width, "x", height);

    // Embed fonts
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Try to download and embed logo
    let logoImage = null;
    try {
      const logoUrl = `${supabaseUrl}/storage/v1/object/public/email-assets/eon-sign-logo.png`;
      console.log("Downloading logo from:", logoUrl);
      const logoResponse = await fetch(logoUrl);
      if (logoResponse.ok) {
        const logoBytes = await logoResponse.arrayBuffer();
        logoImage = await pdfDoc.embedPng(new Uint8Array(logoBytes));
        console.log("Logo embedded successfully");
      } else {
        console.log("Logo not found, skipping:", logoResponse.status);
      }
    } catch (logoError) {
      console.log("Error loading logo, skipping:", logoError);
    }

    // Get display name and CPF
    const displayName = getDisplayName(typedSignature || signerData.name);
    const cpfFormatted = formatCPF(signerData.cpf);
    
    // Signature date
    const signDate = new Date().toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    // === NEW VERTICAL LAYOUT ON RIGHT MARGIN ===
    const rightMargin = 22;
    const signatureAreaStartY = 50;
    
    // Logo dimensions (when rotated)
    const logoDisplaySize = 25;
    
    // Calculate positions for vertical text
    // Elements from bottom to top: Logo, Validation Link, Signatures
    
    // Position X for the vertical strip (from right edge)
    const stripX = width - rightMargin;
    
    // Only draw logo and validation link on first signer (index 0)
    let currentY = signatureAreaStartY;
    
    if (signerIndex === 0) {
      // 1. Draw Logo at the bottom (rotated 90 degrees)
      if (logoImage) {
        const logoDims = logoImage.scale(logoDisplaySize / logoImage.height);
        lastPage.drawImage(logoImage, {
          x: stripX - logoDims.height / 2,
          y: currentY,
          width: logoDims.width,
          height: logoDims.height,
          rotate: degrees(90),
        });
        currentY += logoDims.width + 8;
        console.log("Logo drawn at Y:", signatureAreaStartY);
      }

      // 2. Draw validation link (rotated 90 degrees)
      const validationText = normalizeText(`Verifique em: app.eon.med.br/verificacao/${documentId}`);
      lastPage.drawText(validationText, {
        x: stripX + 3,
        y: currentY,
        size: 5,
        font: helveticaFont,
        color: rgb(0.42, 0.45, 0.50),
        rotate: degrees(90),
      });
      
      // Estimate text width for positioning next element
      const validationTextWidth = helveticaFont.widthOfTextAtSize(validationText, 5);
      currentY += validationTextWidth + 15;
      console.log("Validation link drawn, currentY now:", currentY);
    } else {
      // For subsequent signers, calculate where their signature should start
      // Logo + validation link space
      const logoSpace = logoImage ? logoDisplaySize + 8 : 0;
      const validationText = `Verifique em: app.eon.med.br/verificacao/${documentId}`;
      const validationTextWidth = helveticaFont.widthOfTextAtSize(validationText, 5);
      currentY = signatureAreaStartY + logoSpace + validationTextWidth + 15;
      
      // Add space for previous signers
      const signatureHeight = 55; // Height each signature occupies
      currentY += signerIndex * signatureHeight;
    }

    // 3. Draw signature (rotated 90 degrees)
    // Line 1: Name + CPF
    const nameCpfText = cpfFormatted 
      ? normalizeText(`${displayName} - ${cpfFormatted}`)
      : normalizeText(displayName);
    
    // Adjust font size based on text length
    let fontSize = 7;
    if (nameCpfText.length > 50) fontSize = 5;
    else if (nameCpfText.length > 40) fontSize = 6;
    
    lastPage.drawText(nameCpfText, {
      x: stripX + 3,
      y: currentY,
      size: fontSize,
      font: helveticaBold,
      color: rgb(0.22, 0.25, 0.32),
      rotate: degrees(90),
    });

    // Line 2: Date/time (offset to the left)
    const dateText = normalizeText(`Assinado em ${signDate}`);
    lastPage.drawText(dateText, {
      x: stripX - 7,
      y: currentY,
      size: 5,
      font: helveticaFont,
      color: rgb(0.42, 0.45, 0.50),
      rotate: degrees(90),
    });

    console.log(`Signature drawn for signer ${signerIndex + 1}/${totalSigners} at Y:${currentY}`);

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
