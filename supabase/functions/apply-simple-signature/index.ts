import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Format CPF for display
const formatCpf = (cpf: string) => {
  const clean = cpf?.replace(/\D/g, "") || "";
  if (clean.length === 11) {
    return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9)}`;
  } else if (clean.length === 14) {
    return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 8)}/${clean.slice(8, 12)}-${clean.slice(12)}`;
  }
  return cpf || "";
};

// Format phone for display
const formatPhone = (phone: string) => {
  const clean = phone?.replace(/\D/g, "") || "";
  if (clean.length === 11) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  }
  return phone || "";
};

// Format date for display
const formatDate = (dateStr: string) => {
  if (!dateStr) return "N/A";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR");
  } catch {
    return dateStr;
  }
};

// Format datetime for display
const formatDateTime = (dateStr: string) => {
  if (!dateStr) return "N/A";
  try {
    const date = new Date(dateStr);
    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return dateStr;
  }
};

// Generate QR code URL using external API
const generateQrCodeUrl = (data: string, size: number = 150): string => {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}&format=png`;
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

    // Calculate signature position
    const sigX = signatureX ? (signatureX / 100) * width : 50;
    const sigY = signatureY ? height - ((signatureY / 100) * height) : height - 200;

    // Draw signature box
    const signatureBoxWidth = 250;
    const signatureBoxHeight = 80;
    
    page.drawRectangle({
      x: sigX,
      y: sigY - signatureBoxHeight,
      width: signatureBoxWidth,
      height: signatureBoxHeight,
      color: rgb(0.98, 0.98, 0.98),
      borderColor: rgb(0.7, 0.7, 0.7),
      borderWidth: 1,
    });

    // Draw typed signature
    page.drawText(typedSignature || signerData.name, {
      x: sigX + 10,
      y: sigY - 35,
      size: 24,
      font: helveticaBold,
      color: rgb(0.1, 0.1, 0.3),
    });

    page.drawText("Assinatura Eletronica", {
      x: sigX + 10,
      y: sigY - 55,
      size: 8,
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
      x: sigX + 10,
      y: sigY - 70,
      size: 8,
      font: helveticaFont,
      color: rgb(0.4, 0.4, 0.4),
    });

    // If this is the last signer, add validation page with logo and QR code
    if (isLastSigner && allSignersData && allSignersData.length > 0) {
      console.log("Adding validation page with logo and QR code");
      
      const APP_URL = Deno.env.get("APP_URL") || "https://sign.eongerenciamento.com.br";
      const validationUrl = `${APP_URL}/validar/${documentId}`;
      
      // Create validation page (A4)
      const validationPage = pdfDoc.addPage([595.28, 841.89]);
      
      // Colors
      const primaryColor = rgb(0.153, 0.239, 0.376); // #273d60
      const darkColor = rgb(0.0, 0.102, 0.302); // #001a4d
      const grayColor = rgb(0.4, 0.4, 0.4);
      const lightGrayColor = rgb(0.6, 0.6, 0.6);
      
      // Header background
      validationPage.drawRectangle({
        x: 0,
        y: 741.89,
        width: 595.28,
        height: 100,
        color: primaryColor,
      });

      // Try to embed company logo
      let logoEmbedded = false;
      if (companySettings?.logo_url) {
        try {
          console.log("Downloading company logo:", companySettings.logo_url);
          const logoResponse = await fetch(companySettings.logo_url);
          if (logoResponse.ok) {
            const logoBuffer = await logoResponse.arrayBuffer();
            const contentType = logoResponse.headers.get("content-type") || "";
            
            let logoImage;
            if (contentType.includes("png")) {
              logoImage = await pdfDoc.embedPng(logoBuffer);
            } else if (contentType.includes("jpeg") || contentType.includes("jpg")) {
              logoImage = await pdfDoc.embedJpg(logoBuffer);
            }
            
            if (logoImage) {
              const logoMaxHeight = 60;
              const logoMaxWidth = 150;
              const logoDims = logoImage.scale(Math.min(logoMaxWidth / logoImage.width, logoMaxHeight / logoImage.height));
              
              validationPage.drawImage(logoImage, {
                x: 50,
                y: 760,
                width: logoDims.width,
                height: logoDims.height,
              });
              logoEmbedded = true;
              console.log("Logo embedded successfully");
            }
          }
        } catch (logoError) {
          console.error("Error embedding logo:", logoError);
        }
      }

      // Header text (adjust position based on logo)
      const headerTextX = logoEmbedded ? 220 : 50;
      
      validationPage.drawText("PAGINA DE VALIDACAO", {
        x: headerTextX,
        y: 800,
        size: 20,
        font: helveticaBold,
        color: rgb(1, 1, 1),
      });

      validationPage.drawText("ASSINATURAS ELETRONICAS", {
        x: headerTextX,
        y: 778,
        size: 12,
        font: helveticaFont,
        color: rgb(0.85, 0.85, 0.85),
      });

      if (companySettings?.company_name) {
        validationPage.drawText(companySettings.company_name, {
          x: headerTextX,
          y: 756,
          size: 10,
          font: helveticaFont,
          color: rgb(0.7, 0.7, 0.7),
        });
      }

      // QR Code section
      try {
        console.log("Generating QR code for:", validationUrl);
        const qrCodeUrl = generateQrCodeUrl(validationUrl, 120);
        const qrResponse = await fetch(qrCodeUrl);
        
        if (qrResponse.ok) {
          const qrBuffer = await qrResponse.arrayBuffer();
          const qrImage = await pdfDoc.embedPng(qrBuffer);
          
          // QR code box on right side
          validationPage.drawRectangle({
            x: 430,
            y: 620,
            width: 140,
            height: 160,
            color: rgb(0.97, 0.97, 0.97),
            borderColor: rgb(0.85, 0.85, 0.85),
            borderWidth: 1,
          });
          
          validationPage.drawImage(qrImage, {
            x: 445,
            y: 660,
            width: 110,
            height: 110,
          });
          
          validationPage.drawText("Verificar Online", {
            x: 460,
            y: 640,
            size: 9,
            font: helveticaBold,
            color: primaryColor,
          });
          
          validationPage.drawText("Escaneie o QR Code", {
            x: 455,
            y: 628,
            size: 7,
            font: helveticaFont,
            color: grayColor,
          });
          
          console.log("QR code embedded successfully");
        }
      } catch (qrError) {
        console.error("Error embedding QR code:", qrError);
      }

      // Document info section
      let currentY = 710;
      
      validationPage.drawText("INFORMACOES DO DOCUMENTO", {
        x: 50,
        y: currentY,
        size: 11,
        font: helveticaBold,
        color: primaryColor,
      });
      currentY -= 20;

      // Info box
      validationPage.drawRectangle({
        x: 40,
        y: currentY - 55,
        width: 370,
        height: 70,
        color: rgb(0.98, 0.98, 0.98),
        borderColor: rgb(0.9, 0.9, 0.9),
        borderWidth: 0.5,
      });

      validationPage.drawText(`Documento: ${document.name}`, {
        x: 50,
        y: currentY - 15,
        size: 10,
        font: helveticaFont,
        color: rgb(0.2, 0.2, 0.2),
      });

      validationPage.drawText(`ID: ${documentId}`, {
        x: 50,
        y: currentY - 30,
        size: 9,
        font: helveticaFont,
        color: grayColor,
      });

      validationPage.drawText(`Data de conclusao: ${signDate}`, {
        x: 50,
        y: currentY - 45,
        size: 9,
        font: helveticaFont,
        color: grayColor,
      });
      
      currentY -= 80;

      // Signers section title
      validationPage.drawText("SIGNATARIOS", {
        x: 50,
        y: currentY,
        size: 11,
        font: helveticaBold,
        color: primaryColor,
      });
      currentY -= 25;

      // Draw each signer's information
      for (let i = 0; i < allSignersData.length; i++) {
        const signer = allSignersData[i];
        
        // Check if we need a new page
        if (currentY < 120) {
          const newPage = pdfDoc.addPage([595.28, 841.89]);
          currentY = 800;
          
          newPage.drawText("SIGNATARIOS (continuacao)", {
            x: 50,
            y: currentY,
            size: 11,
            font: helveticaBold,
            color: primaryColor,
          });
          currentY -= 25;
        }

        // Signer card
        const cardHeight = 95;
        validationPage.drawRectangle({
          x: 40,
          y: currentY - cardHeight + 15,
          width: 515,
          height: cardHeight,
          color: rgb(1, 1, 1),
          borderColor: rgb(0.85, 0.85, 0.85),
          borderWidth: 1,
        });

        // Signer number badge
        validationPage.drawRectangle({
          x: 40,
          y: currentY - 2,
          width: 80,
          height: 18,
          color: primaryColor,
        });

        validationPage.drawText(`Signatario ${i + 1}`, {
          x: 48,
          y: currentY + 2,
          size: 9,
          font: helveticaBold,
          color: rgb(1, 1, 1),
        });

        // Signer name
        validationPage.drawText(signer.name || "N/A", {
          x: 130,
          y: currentY + 2,
          size: 11,
          font: helveticaBold,
          color: rgb(0.15, 0.15, 0.15),
        });

        // Signed checkmark
        validationPage.drawText("Assinado", {
          x: 480,
          y: currentY + 2,
          size: 8,
          font: helveticaBold,
          color: rgb(0.086, 0.639, 0.290), // green
        });

        const lineHeight = 13;
        let infoY = currentY - 18;

        // Two column layout for signer details
        // Left column
        validationPage.drawText(`CPF/CNPJ: ${formatCpf(signer.cpf)}`, {
          x: 50,
          y: infoY,
          size: 9,
          font: helveticaFont,
          color: rgb(0.25, 0.25, 0.25),
        });

        validationPage.drawText(`Nascimento: ${formatDate(signer.birth_date)}`, {
          x: 50,
          y: infoY - lineHeight,
          size: 9,
          font: helveticaFont,
          color: rgb(0.25, 0.25, 0.25),
        });

        validationPage.drawText(`E-mail: ${signer.email || "N/A"}`, {
          x: 50,
          y: infoY - lineHeight * 2,
          size: 9,
          font: helveticaFont,
          color: rgb(0.25, 0.25, 0.25),
        });

        validationPage.drawText(`Telefone: ${formatPhone(signer.phone)}`, {
          x: 50,
          y: infoY - lineHeight * 3,
          size: 9,
          font: helveticaFont,
          color: rgb(0.25, 0.25, 0.25),
        });

        // Right column
        validationPage.drawText(`IP: ${signer.signature_ip || "N/A"}`, {
          x: 300,
          y: infoY,
          size: 9,
          font: helveticaFont,
          color: rgb(0.25, 0.25, 0.25),
        });

        let locationStr = "N/A";
        if (signer.signature_city || signer.signature_state) {
          locationStr = [signer.signature_city, signer.signature_state].filter(Boolean).join(", ");
          if (signer.signature_country) {
            locationStr += ` - ${signer.signature_country}`;
          }
        }
        
        validationPage.drawText(`Local: ${locationStr}`, {
          x: 300,
          y: infoY - lineHeight,
          size: 9,
          font: helveticaFont,
          color: rgb(0.25, 0.25, 0.25),
        });

        // Truncate signature ID for display
        const shortSignatureId = signer.signature_id ? signer.signature_id.substring(0, 18) + "..." : "N/A";
        validationPage.drawText(`ID: ${shortSignatureId}`, {
          x: 300,
          y: infoY - lineHeight * 2,
          size: 9,
          font: helveticaFont,
          color: rgb(0.25, 0.25, 0.25),
        });

        validationPage.drawText(`Data/Hora: ${formatDateTime(signer.signed_at)}`, {
          x: 300,
          y: infoY - lineHeight * 3,
          size: 9,
          font: helveticaFont,
          color: rgb(0.25, 0.25, 0.25),
        });

        currentY -= cardHeight + 10;
      }

      // Footer
      validationPage.drawLine({
        start: { x: 40, y: 70 },
        end: { x: 555, y: 70 },
        thickness: 1,
        color: rgb(0.85, 0.85, 0.85),
      });

      validationPage.drawText("Documento validado pelo sistema Eon Sign", {
        x: 50,
        y: 52,
        size: 9,
        font: helveticaBold,
        color: primaryColor,
      });

      validationPage.drawText("Este documento possui validade juridica conforme Lei n. 14.063/2020 e MP 2.200-2/2001", {
        x: 50,
        y: 38,
        size: 8,
        font: helveticaFont,
        color: lightGrayColor,
      });

      validationPage.drawText(`Verificacao: ${validationUrl}`, {
        x: 50,
        y: 24,
        size: 7,
        font: helveticaFont,
        color: lightGrayColor,
      });
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
