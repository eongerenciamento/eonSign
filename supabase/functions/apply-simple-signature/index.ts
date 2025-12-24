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

// Helper to download and embed selfie image
const embedSelfieImage = async (
  pdfDoc: any,
  supabase: any,
  selfieUrl: string | null
): Promise<any> => {
  if (!selfieUrl) return null;

  try {
    // Extract path from storage URL
    let selfiePath: string;
    if (selfieUrl.includes('/biometry/')) {
      const urlParts = selfieUrl.split('/biometry/');
      selfiePath = decodeURIComponent(urlParts[urlParts.length - 1].split('?')[0]);
    } else if (selfieUrl.includes('/selfies/')) {
      const urlParts = selfieUrl.split('/selfies/');
      selfiePath = decodeURIComponent(urlParts[urlParts.length - 1].split('?')[0]);
    } else {
      selfiePath = selfieUrl;
    }

    console.log("Downloading selfie from path:", selfiePath);

    // Try biometry bucket first, then selfies
    let selfieData = null;
    let error = null;

    const { data: biometryData, error: biometryError } = await supabase.storage
      .from("biometry")
      .download(selfiePath);

    if (!biometryError && biometryData) {
      selfieData = biometryData;
    } else {
      // Try selfies bucket
      const { data: selfiesData, error: selfiesError } = await supabase.storage
        .from("selfies")
        .download(selfiePath);
      
      if (!selfiesError && selfiesData) {
        selfieData = selfiesData;
      } else {
        error = selfiesError || biometryError;
      }
    }

    if (error || !selfieData) {
      console.log("Selfie not found in storage:", error);
      return null;
    }

    const selfieBytes = await selfieData.arrayBuffer();
    console.log("Selfie downloaded, size:", selfieBytes.byteLength);

    // Try to embed as JPEG first, then PNG
    try {
      return await pdfDoc.embedJpg(new Uint8Array(selfieBytes));
    } catch {
      try {
        return await pdfDoc.embedPng(new Uint8Array(selfieBytes));
      } catch (embedError) {
        console.log("Error embedding selfie image:", embedError);
        return null;
      }
    }
  } catch (err) {
    console.log("Error processing selfie:", err);
    return null;
  }
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
      .select("name, cpf, signed_at, typed_signature, selfie_url, signature_ip, signature_city, signature_state")
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
        typed_signature: typedSignature,
        selfie_url: signerData.selfie_url || null,
        signature_ip: signerData.signature_ip || null,
        signature_city: signerData.signature_city || null,
        signature_state: signerData.signature_state || null
      });
    }

    // Determine how many signers to display (max 3 when 4+ signers)
    const totalSignersCount = signedSigners.length;
    const showAllSigners = totalSignersCount <= 3;
    const signersToDisplay = showAllSigners 
      ? signedSigners 
      : signedSigners.slice(0, 3);

    console.log(`Total signed signers: ${totalSignersCount}, displaying: ${signersToDisplay.length} (truncated: ${!showAllSigners})`);

    // Pre-load all selfie images
    const signerSelfies: Map<string, any> = new Map();
    for (const signer of signersToDisplay) {
      if (signer.selfie_url) {
        const selfieImage = await embedSelfieImage(pdfDoc, supabase, signer.selfie_url);
        if (selfieImage) {
          const signerKey = signer.cpf || signer.name;
          signerSelfies.set(signerKey, selfieImage);
          console.log("Selfie embedded for:", signerKey);
        }
      }
    }

    // === LAYOUT: THREE COLUMNS ON RIGHT MARGIN ===
    // Column 1 (leftmost): Validation link - X = 28
    // Column 2 (middle): Metadata text - X = 16
    // Column 3 (rightmost): Selfie thumbnail - X = 6
    
    const validationColumnX = 28;  // Validation link (leftmost)
    const metadataColumnX = 16;    // Signer metadata (middle)
    const selfieColumnX = 6;       // Selfie photo (rightmost)
    const selfieSize = 22;         // Selfie thumbnail size in points
    const startY = 35;             // Start closer to footer

    // Apply signatures to ALL pages
    for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
      const page = pages[pageIndex];
      const { width, height } = page.getSize();
      
      // Calculate where signatures start (after logo if present)
      let signaturesStartY = startY;
      
      // 1. Draw Logo centered between columns
      if (logoImage) {
        const logoDisplaySize = 25;
        const logoDims = logoImage.scale(logoDisplaySize / logoImage.height);
        
        // Position logo at the center between validation and selfie columns
        const logoColumnX = (validationColumnX + selfieColumnX) / 2;
        
        page.drawImage(logoImage, {
          x: width - logoColumnX + (logoDims.height / 2),
          y: startY,
          width: logoDims.width,
          height: logoDims.height,
          rotate: degrees(90),
        });
        signaturesStartY = startY + logoDims.width + 10;
      }

      let currentY = signaturesStartY;

      // 2. Draw each signature with metadata on left and selfie on right
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

        // Build security indicators (without "Biometria" - the photo shows it)
        const securityIndicators: string[] = [];
        if (signer.signature_city || signer.signature_state) {
          const city = signer.signature_city || "";
          const state = signer.signature_state || "";
          if (city && state) {
            securityIndicators.push(`${city}/${state}`);
          } else {
            securityIndicators.push(city || state);
          }
        }
        if (signer.signature_ip) {
          securityIndicators.push(`IP: ${signer.signature_ip}`);
        }

        // Build metadata text: Nome - CPF - Assinado em DD/MM/YYYY às HH:MM [Geo | IP]
        let metadataText = displayName;
        if (cpfFormatted) {
          metadataText += ` - ${cpfFormatted}`;
        }
        metadataText += ` - ${signDate}`;
        
        // Add security indicators if any
        if (securityIndicators.length > 0) {
          metadataText += ` [${securityIndicators.join(" | ")}]`;
        }
        
        metadataText = normalizeText(metadataText);

        // Adjust font size based on text length
        let fontSize = 6;
        if (metadataText.length > 70) fontSize = 4.5;
        else if (metadataText.length > 55) fontSize = 5;
        else if (metadataText.length > 45) fontSize = 5.5;

        // Draw metadata text (middle column)
        page.drawText(metadataText, {
          x: width - metadataColumnX,
          y: currentY,
          size: fontSize,
          font: helveticaBold,
          color: rgb(0.22, 0.25, 0.32),
          rotate: degrees(90),
        });

        // Draw selfie thumbnail (rightmost column)
        const signerKey = signer.cpf || signer.name;
        const selfieImage = signerSelfies.get(signerKey);
        
        if (selfieImage) {
          // Calculate scale to fit within selfieSize while maintaining aspect ratio
          const originalWidth = selfieImage.width;
          const originalHeight = selfieImage.height;
          const scaleFactor = Math.min(selfieSize / originalWidth, selfieSize / originalHeight);
          const scaledWidth = originalWidth * scaleFactor;
          const scaledHeight = originalHeight * scaleFactor;

          // Draw selfie at rightmost column, rotated 90 degrees
          page.drawImage(selfieImage, {
            x: width - selfieColumnX,
            y: currentY,
            width: scaledWidth,
            height: scaledHeight,
            rotate: degrees(90),
          });
        }

        // Move up for next signature (use max of text width or selfie size + spacing)
        const textWidth = helveticaBold.widthOfTextAtSize(metadataText, fontSize);
        const rowHeight = Math.max(textWidth, selfieImage ? selfieSize : 0);
        currentY += rowHeight + 15;
      }

      // 3. Draw validation link (leftmost column)
      let validationText = `Verifique em: sign.eonhub.com.br/validar/${documentId}`;
      if (!showAllSigners) {
        validationText += ` / verifique todos os signatarios na pagina de assinaturas`;
      }
      validationText = normalizeText(validationText);
      
      const validationFontSize = showAllSigners ? 5 : 4.5;
      
      page.drawText(validationText, {
        x: width - validationColumnX,
        y: signaturesStartY,
        size: validationFontSize,
        font: helveticaFont,
        color: rgb(0.42, 0.45, 0.50),
        rotate: degrees(90),
      });

      console.log(`Page ${pageIndex + 1}/${totalPages}: Applied ${signersToDisplay.length} signatures with ${signerSelfies.size} selfies`);
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
