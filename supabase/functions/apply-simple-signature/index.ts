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

    console.log("Total pages in document:", totalPages);

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

    // Get all signers to display all signatures accumulated so far
    const { data: allSigners, error: signersError } = await supabase
      .from("document_signers")
      .select("name, cpf, signed_at, typed_signature")
      .eq("document_id", documentId)
      .not("signed_at", "is", null)
      .order("signed_at", { ascending: true });

    if (signersError) {
      console.error("Error fetching signers:", signersError);
    }

    const signedSigners = allSigners || [];
    
    // Add current signer if not in the list yet
    const currentSignerExists = signedSigners.some(s => 
      s.cpf === signerData.cpf || s.name === signerData.name
    );
    
    if (!currentSignerExists) {
      signedSigners.push({
        name: typedSignature || signerData.name,
        cpf: signerData.cpf,
        signed_at: new Date().toISOString(),
        typed_signature: typedSignature
      });
    }

    // Determine how many signers to display (max 3 when 4+ signers)
    const totalSignersCount = signedSigners.length;
    const showAllSigners = totalSignersCount <= 3;
    const signersToDisplay = showAllSigners 
      ? signedSigners 
      : signedSigners.slice(0, 3);

    console.log(`Total signed signers: ${totalSignersCount}, displaying: ${signersToDisplay.length} (truncated: ${!showAllSigners})`);

    // === LAYOUT: TWO VERTICAL COLUMNS ON RIGHT MARGIN ===
    // Column 1 (left): Validation link
    // Column 2 (right): Logo + Signatures
    
    const validationColumnX = 18;  // Leftmost column (validation link)
    const signaturesColumnX = 8;   // Rightmost column (signatures)
    const startY = 35;             // Start closer to footer

    // Apply signatures to ALL pages
    for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
      const page = pages[pageIndex];
      const { width, height } = page.getSize();
      
      // Calculate where signatures start (after logo if present)
      let signaturesStartY = startY;
      
      // 1. Draw Logo aligned with the two text columns
      if (logoImage) {
        const logoDisplaySize = 25;
        const logoDims = logoImage.scale(logoDisplaySize / logoImage.height);
        
        // Position logo at the center between validation (18) and signatures (8) columns
        // With 90° rotation, the image rotates around (x, y) point
        // To align correctly, we position it at the midpoint without additional offset
        const logoColumnX = (validationColumnX + signaturesColumnX) / 2;  // = 13
        
        page.drawImage(logoImage, {
          x: width - logoColumnX + (logoDims.height / 2),  // Center the logo visually between columns
          y: startY,
          width: logoDims.width,
          height: logoDims.height,
          rotate: degrees(90),
        });
        signaturesStartY = startY + logoDims.width + 10;
      }

      let currentY = signaturesStartY;

      // 2. Draw each signature (Nome - CPF - Assinado em DD/MM/YYYY às HH:MM)
      // Only display first 3 signers when 4+ total signers
      for (const signer of signersToDisplay) {
        const displayName = getDisplayName(signer.typed_signature || signer.name);
        const cpfFormatted = formatCPF(signer.cpf);
        
        const signDate = signer.signed_at 
          ? new Date(signer.signed_at).toLocaleString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "America/Sao_Paulo",
            })
          : new Date().toLocaleString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "America/Sao_Paulo",
            });

        // Build signature text: Nome - CPF - Assinado em DD/MM/YYYY às HH:MM
        let signatureText = displayName;
        if (cpfFormatted) {
          signatureText += ` - ${cpfFormatted}`;
        }
        signatureText += ` - Assinado em ${signDate}`;
        signatureText = normalizeText(signatureText);

        // Adjust font size based on text length
        let fontSize = 6;
        if (signatureText.length > 70) fontSize = 4.5;
        else if (signatureText.length > 55) fontSize = 5;
        else if (signatureText.length > 45) fontSize = 5.5;

        page.drawText(signatureText, {
          x: width - signaturesColumnX,
          y: currentY,
          size: fontSize,
          font: helveticaBold,
          color: rgb(0.22, 0.25, 0.32),
          rotate: degrees(90),
        });

        // Move up for next signature (text width + spacing)
        const textWidth = helveticaBold.widthOfTextAtSize(signatureText, fontSize);
        currentY += textWidth + 12;
      }

      // 3. Draw validation link aligned with first signatory
      // Add suffix when not all signers are displayed
      let validationText = `Verifique em: sign.eonhub.com.br/validar/${documentId}`;
      if (!showAllSigners) {
        validationText += ` / verifique todos os signatarios na pagina de assinaturas`;
      }
      validationText = normalizeText(validationText);
      
      // Adjust font size if text is longer (when showing truncation message)
      const validationFontSize = showAllSigners ? 5 : 4.5;
      
      page.drawText(validationText, {
        x: width - validationColumnX,
        y: signaturesStartY,  // Aligned with first signatory, after logo
        size: validationFontSize,
        font: helveticaFont,
        color: rgb(0.42, 0.45, 0.50),
        rotate: degrees(90),
      });

      console.log(`Page ${pageIndex + 1}/${totalPages}: Applied ${signersToDisplay.length} of ${totalSignersCount} signatures (truncated: ${!showAllSigners})`);
    }

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
