import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GenerateReportRequest {
  documentId: string;
}

// Helper to remove accents and special characters for PDF compatibility
const normalizeText = (text: string | null): string => {
  if (!text) return "N/A";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove combining diacritical marks
    .replace(/[^\x00-\x7F]/g, ""); // Remove any remaining non-ASCII characters
};

// Helper functions
const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return "N/A";
  return new Date(dateStr).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatCpf = (cpf: string | null): string => {
  if (!cpf) return "N/A";
  const cleaned = cpf.replace(/\D/g, "");
  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9)}`;
  }
  return cpf;
};

const formatPhone = (phone: string | null): string => {
  if (!phone) return "N/A";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)})${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
};

// Truncate text to fit within a certain width
const truncateText = (text: string | null, maxLength: number): string => {
  if (!text) return "N/A";
  const normalized = normalizeText(text);
  if (normalized.length <= maxLength) return normalized;
  return normalized.substring(0, maxLength - 3) + "...";
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
    let bucketName = "biometry";
    let selfiePath: string;

    if (selfieUrl.includes('/biometry/')) {
      const urlParts = selfieUrl.split('/biometry/');
      selfiePath = decodeURIComponent(urlParts[urlParts.length - 1].split('?')[0]);
    } else if (selfieUrl.includes('/selfies/')) {
      bucketName = "selfies";
      const urlParts = selfieUrl.split('/selfies/');
      selfiePath = decodeURIComponent(urlParts[urlParts.length - 1].split('?')[0]);
    } else {
      selfiePath = selfieUrl;
    }

    console.log(`Downloading selfie from bucket "${bucketName}", path: ${selfiePath}`);

    // Try biometry bucket first
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

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentId }: GenerateReportRequest = await req.json();
    console.log("Generating signature report for document:", documentId);

    const supabase = createClient(supabaseUrl, supabaseKey);
    const APP_URL = Deno.env.get("APP_URL") || "https://sign.eonhub.com.br";

    // Fetch document
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("id, name, status, created_at, updated_at, user_id")
      .eq("id", documentId)
      .single();

    if (docError || !document) {
      throw new Error("Documento não encontrado");
    }

    // Fetch signers with all details
    const { data: signers, error: signersError } = await supabase
      .from("document_signers")
      .select(
        "name, email, phone, cpf, birth_date, status, signed_at, signature_ip, signature_city, signature_state, signature_country, signature_id, selfie_url",
      )
      .eq("document_id", documentId);

    if (signersError) {
      throw new Error("Erro ao buscar signatários");
    }

    // Create PDF
    const pdfDoc = await PDFDocument.create();
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const pageWidth = 595; // A4 width in points
    const pageHeight = 842; // A4 height in points
    const margin = 40;

    // Colors
    const gray300 = rgb(212 / 255, 215 / 255, 219 / 255);
    const gray600 = rgb(102 / 255, 107 / 255, 120 / 255);
    const greenColor = rgb(22 / 255, 163 / 255, 74 / 255);
    const white = rgb(1, 1, 1);
    const lightGray = rgb(250 / 255, 250 / 255, 250 / 255);
    const borderGray = rgb(230 / 255, 230 / 255, 230 / 255);
    const cardBorderGray = rgb(217 / 255, 217 / 255, 217 / 255);

    // Pre-load all selfie images
    console.log("Pre-loading selfie images for signers...");
    const signerSelfies: Map<string, any> = new Map();
    
    for (const signer of signers) {
      if (signer.selfie_url) {
        const signerKey = signer.cpf || signer.email || signer.name;
        const selfieImage = await embedSelfieImage(pdfDoc, supabase, signer.selfie_url);
        if (selfieImage) {
          signerSelfies.set(signerKey, selfieImage);
          console.log("Selfie embedded for:", signerKey);
        }
      }
    }
    
    console.log(`Total selfies loaded: ${signerSelfies.size}`);

    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let yPos = pageHeight;

    // Header background - medium gray
    const headerBg = rgb(156 / 255, 163 / 255, 175 / 255); // medium gray
    page.drawRectangle({
      x: 0,
      y: pageHeight - 70,
      width: pageWidth,
      height: 70,
      color: headerBg,
    });

    // Draw "eonSign" text as logo
    page.drawText("eonSign", {
      x: margin,
      y: pageHeight - 45,
      size: 20,
      font: helveticaBold,
      color: white,
    });

    // Title - white for contrast with dark header
    page.drawText("RELATÓRIO DE ASSINATURAS", {
      x: pageWidth - margin - helveticaBold.widthOfTextAtSize("RELATÓRIO DE ASSINATURAS", 16),
      y: pageHeight - 45,
      size: 16,
      font: helveticaBold,
      color: white,
    });

    yPos = pageHeight - 95;

    // Document Info Section title
    page.drawText("INFORMAÇÕES DO DOCUMENTO", {
      x: margin,
      y: yPos,
      size: 11,
      font: helveticaBold,
      color: gray600,
    });

    yPos -= 25;

    // Info box
    const infoBoxHeight = 70;
    page.drawRectangle({
      x: margin,
      y: yPos - infoBoxHeight,
      width: pageWidth - margin * 2,
      height: infoBoxHeight,
      color: lightGray,
      borderColor: borderGray,
      borderWidth: 1,
    });

    const completedAt = document.status === "signed" ? document.updated_at : null;

    // Truncate document name if too long
    const maxDocNameLength = 60;
    const displayDocName = truncateText(document.name, maxDocNameLength);

    page.drawText(`Documento: ${displayDocName}`, {
      x: margin + 10,
      y: yPos - 20,
      size: 10,
      font: helveticaFont,
      color: gray600,
    });

    page.drawText(`ID: ${document.id}`, {
      x: margin + 10,
      y: yPos - 35,
      size: 9,
      font: helveticaFont,
      color: gray600,
    });

    page.drawText(`Data de conclusão: ${completedAt ? formatDate(completedAt) : "Pendente"}`, {
      x: margin + 10,
      y: yPos - 50,
      size: 9,
      font: helveticaFont,
      color: gray600,
    });

    yPos -= infoBoxHeight + 30;

    // Signers Section title
    page.drawText("SIGNATÁRIOS", {
      x: margin,
      y: yPos,
      size: 11,
      font: helveticaBold,
      color: gray600,
    });

    yPos -= 25;

    // Selfie configuration
    const selfieSize = 70;
    const selfieMargin = 10;

    // Draw each signer card
    for (let i = 0; i < signers.length; i++) {
      const signer = signers[i];
      const signerKey = signer.cpf || signer.email || signer.name;
      const selfieImage = signerSelfies.get(signerKey);
      const hasSelfie = !!selfieImage;
      
      // Increase card height if selfie is present
      const cardHeight = hasSelfie ? 140 : 110;

      // Check if we need a new page
      if (yPos - cardHeight < 100) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        yPos = pageHeight - 40;

        page.drawText("SIGNATÁRIOS (continuação)", {
          x: margin,
          y: yPos,
          size: 11,
          font: helveticaBold,
          color: gray600,
        });

        yPos -= 25;
      }

      // Card background
      page.drawRectangle({
        x: margin,
        y: yPos - cardHeight,
        width: pageWidth - margin * 2,
        height: cardHeight,
        color: white,
        borderColor: cardBorderGray,
        borderWidth: 1,
      });

      // Signer number badge
      page.drawRectangle({
        x: margin,
        y: yPos - 25,
        width: 70,
        height: 25,
        color: gray300,
      });

      page.drawText(`Signatário ${i + 1}`, {
        x: margin + 8,
        y: yPos - 17,
        size: 8,
        font: helveticaBold,
        color: gray600,
      });

      // Truncate signer name to fit within card
      const maxNameLength = 35;
      const displayName = truncateText(signer.name, maxNameLength);

      page.drawText(displayName, {
        x: margin + 80,
        y: yPos - 17,
        size: 10,
        font: helveticaBold,
        color: gray600,
      });

      // Signed status badge
      if (signer.status === "signed") {
        page.drawText("Assinado", {
          x: pageWidth - margin - 50,
          y: yPos - 17,
          size: 8,
          font: helveticaBold,
          color: greenColor,
        });
      }

      // Left column details
      const lineHeight = 14;
      let leftY = yPos - 40;

      page.drawText(`CPF/CNPJ: ${formatCpf(signer.cpf)}`, {
        x: margin + 10,
        y: leftY,
        size: 10,
        font: helveticaFont,
        color: gray600,
      });
      leftY -= lineHeight;

      page.drawText(`Nascimento: ${signer.birth_date ? formatDate(signer.birth_date).split(" ")[0] : "N/A"}`, {
        x: margin + 10,
        y: leftY,
        size: 10,
        font: helveticaFont,
        color: gray600,
      });
      leftY -= lineHeight;

      // Truncate email if too long
      const maxEmailLength = 30;
      const displayEmail = truncateText(signer.email, maxEmailLength);

      page.drawText(`E-mail: ${displayEmail}`, {
        x: margin + 10,
        y: leftY,
        size: 10,
        font: helveticaFont,
        color: gray600,
      });
      leftY -= lineHeight;

      page.drawText(`Telefone: ${formatPhone(signer.phone)}`, {
        x: margin + 10,
        y: leftY,
        size: 10,
        font: helveticaFont,
        color: gray600,
      });

      // Middle column details (shifted left to make room for selfie)
      const middleX = pageWidth / 2 - 30;
      let middleY = yPos - 40;

      page.drawText(`IP: ${signer.signature_ip || "N/A"}`, {
        x: middleX,
        y: middleY,
        size: 10,
        font: helveticaFont,
        color: gray600,
      });
      middleY -= lineHeight;

      let locationStr = "N/A";
      if (signer.signature_city || signer.signature_state) {
        locationStr = [signer.signature_city, signer.signature_state].filter(Boolean).join(", ");
        if (signer.signature_country) {
          locationStr += ` - ${signer.signature_country}`;
        }
      }
      // Truncate and normalize location
      const displayLocation = truncateText(locationStr, 25);

      page.drawText(`Local: ${displayLocation}`, {
        x: middleX,
        y: middleY,
        size: 10,
        font: helveticaFont,
        color: gray600,
      });
      middleY -= lineHeight;

      const signatureId = signer.signature_id || "N/A";
      page.drawText(`ID: ${signatureId}`, {
        x: middleX,
        y: middleY,
        size: 8,
        font: helveticaFont,
        color: gray600,
      });
      middleY -= lineHeight;

      page.drawText(`Data/Hora: ${signer.signed_at ? formatDate(signer.signed_at) : "N/A"}`, {
        x: middleX,
        y: middleY,
        size: 10,
        font: helveticaFont,
        color: gray600,
      });

      // Draw selfie on the right side of the card
      if (selfieImage) {
        // Calculate scale to fit within selfieSize while maintaining aspect ratio
        const originalWidth = selfieImage.width;
        const originalHeight = selfieImage.height;
        const scaleFactor = Math.min(selfieSize / originalWidth, selfieSize / originalHeight);
        const scaledWidth = originalWidth * scaleFactor;
        const scaledHeight = originalHeight * scaleFactor;
        
        // Position selfie on the right side of the card
        const selfieX = pageWidth - margin - selfieSize - selfieMargin;
        const selfieY = yPos - cardHeight + selfieMargin + (selfieSize - scaledHeight) / 2;
        
        // Draw rounded border around selfie using SVG-style path
        const borderRadius = 8;
        const borderX = selfieX - 4;
        const borderY = selfieY - 4;
        const borderW = selfieSize + 8;
        const borderH = selfieSize + 8;
        
        // Draw rounded rectangle border (simulated with lines and arcs)
        page.moveTo(borderX + borderRadius, borderY);
        page.drawSvgPath(
          `M ${borderX + borderRadius} ${borderY} ` +
          `L ${borderX + borderW - borderRadius} ${borderY} ` +
          `Q ${borderX + borderW} ${borderY} ${borderX + borderW} ${borderY + borderRadius} ` +
          `L ${borderX + borderW} ${borderY + borderH - borderRadius} ` +
          `Q ${borderX + borderW} ${borderY + borderH} ${borderX + borderW - borderRadius} ${borderY + borderH} ` +
          `L ${borderX + borderRadius} ${borderY + borderH} ` +
          `Q ${borderX} ${borderY + borderH} ${borderX} ${borderY + borderH - borderRadius} ` +
          `L ${borderX} ${borderY + borderRadius} ` +
          `Q ${borderX} ${borderY} ${borderX + borderRadius} ${borderY} Z`,
          {
            borderColor: cardBorderGray,
            borderWidth: 1.5,
            color: lightGray,
          }
        );
        
        // Draw selfie image
        page.drawImage(selfieImage, {
          x: selfieX + (selfieSize - scaledWidth) / 2,
          y: selfieY,
          width: scaledWidth,
          height: scaledHeight,
        });
      }

      yPos -= cardHeight + 15;
    }

    // Get the last page for footer and QR code
    const lastPage = pdfDoc.getPage(pdfDoc.getPageCount() - 1);

    // Try to add QR code
    try {
      const validationUrl = `${APP_URL}/validar/${documentId}`;
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=80x80&format=png&data=${encodeURIComponent(validationUrl)}`;
      const qrResponse = await fetch(qrCodeUrl);
      if (qrResponse.ok) {
        const qrBytes = await qrResponse.arrayBuffer();
        const qrImage = await pdfDoc.embedPng(new Uint8Array(qrBytes));

        const qrSize = 56;
        const qrX = pageWidth - margin - qrSize;
        const qrY = 55;

        lastPage.drawImage(qrImage, {
          x: qrX,
          y: qrY,
          width: qrSize,
          height: qrSize,
        });

        // QR code label
        lastPage.drawText("Validação", {
          x: qrX + qrSize / 2 - helveticaBold.widthOfTextAtSize("Validação", 8) / 2,
          y: qrY - 12,
          size: 8,
          font: helveticaBold,
          color: gray600,
        });

        lastPage.drawText("Escaneie o QR Code", {
          x: qrX + qrSize / 2 - helveticaFont.widthOfTextAtSize("Escaneie o QR Code", 7) / 2,
          y: qrY - 22,
          size: 7,
          font: helveticaFont,
          color: gray600,
        });
      }
    } catch (e) {
      console.log("Could not generate QR code:", e);
    }

    // Footer
    const footerY = 45;

    lastPage.drawLine({
      start: { x: margin, y: footerY + 15 },
      end: { x: pageWidth - margin - 80, y: footerY + 15 },
      thickness: 1,
      color: cardBorderGray,
    });

    // Footer line 1: "Documento validado pelo sistema eonSign" - only eonSign bold
    const footerText1Part1 = "Documento validado pelo sistema ";
    const footerText1Part2 = "eonSign";
    lastPage.drawText(footerText1Part1, {
      x: margin,
      y: footerY,
      size: 9,
      font: helveticaFont,
      color: gray600,
    });
    lastPage.drawText(footerText1Part2, {
      x: margin + helveticaFont.widthOfTextAtSize(footerText1Part1, 9),
      y: footerY,
      size: 9,
      font: helveticaBold,
      color: gray600,
    });

    // Footer line 2: "Powered by eonhub" - only eonhub bold
    const footerText2Part1 = "Powered by ";
    const footerText2Part2 = "eonhub";
    lastPage.drawText(footerText2Part1, {
      x: margin,
      y: footerY - 12,
      size: 9,
      font: helveticaFont,
      color: gray600,
    });
    lastPage.drawText(footerText2Part2, {
      x: margin + helveticaFont.widthOfTextAtSize(footerText2Part1, 9),
      y: footerY - 12,
      size: 9,
      font: helveticaBold,
      color: gray600,
    });

    // Footer line 3: Legal validity
    lastPage.drawText("Este documento possui validade juridica conforme Lei n. 14.063/2020 e MP 2.200-2/2001", {
      x: margin,
      y: footerY - 24,
      size: 8,
      font: helveticaFont,
      color: gray600,
    });

    // Save PDF
    const pdfBytes = await pdfDoc.save();
    
    console.log(`Signature report generated successfully: ${pdfBytes.byteLength} bytes`);

    // Return pdfBytes as array for download-complete-document compatibility
    return new Response(JSON.stringify({ pdfBytes: Array.from(pdfBytes) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error generating report:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

serve(handler);
