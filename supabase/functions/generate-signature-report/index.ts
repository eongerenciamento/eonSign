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
// Eon Sign logo in Base64 (white PNG)
const LOGO_BASE64 = "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";

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
      .select("name, email, phone, cpf, birth_date, status, signed_at, signature_ip, signature_city, signature_state, signature_country, signature_id")
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

    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let yPos = pageHeight;

    // Header background - dark blue for white logo
    const headerBg = rgb(39 / 255, 61 / 255, 96 / 255); // #273d60
    page.drawRectangle({
      x: 0,
      y: pageHeight - 70,
      width: pageWidth,
      height: 70,
      color: headerBg,
    });

    // Embed logo from Base64
    try {
      const logoBytes = Uint8Array.from(atob(LOGO_BASE64), c => c.charCodeAt(0));
      const logoImage = await pdfDoc.embedPng(logoBytes);
      const logoMaxHeight = 40;
      const logoScale = logoMaxHeight / logoImage.height;
      const logoWidth = logoImage.width * logoScale;
      page.drawImage(logoImage, {
        x: margin,
        y: pageHeight - 55,
        width: logoWidth,
        height: logoMaxHeight,
      });
      console.log("Logo embedded successfully from Base64");
    } catch (e) {
      console.log("Could not embed logo from Base64, drawing text fallback:", e);
      // Fallback: draw "EON SIGN" text
      page.drawText("EON SIGN", {
        x: margin,
        y: pageHeight - 45,
        size: 20,
        font: helveticaBold,
        color: white,
      });
    }

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

    // Draw each signer card
    for (let i = 0; i < signers.length; i++) {
      const signer = signers[i];
      const cardHeight = 110;

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
        size: 9,
        font: helveticaFont,
        color: gray600,
      });
      leftY -= lineHeight;

      page.drawText(`Nascimento: ${signer.birth_date ? formatDate(signer.birth_date).split(" ")[0] : "N/A"}`, {
        x: margin + 10,
        y: leftY,
        size: 9,
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
        size: 9,
        font: helveticaFont,
        color: gray600,
      });
      leftY -= lineHeight;

      page.drawText(`Telefone: ${formatPhone(signer.phone)}`, {
        x: margin + 10,
        y: leftY,
        size: 9,
        font: helveticaFont,
        color: gray600,
      });

      // Right column details
      const rightX = pageWidth / 2 + 20;
      let rightY = yPos - 40;

      page.drawText(`IP: ${signer.signature_ip || "N/A"}`, {
        x: rightX,
        y: rightY,
        size: 9,
        font: helveticaFont,
        color: gray600,
      });
      rightY -= lineHeight;

      let locationStr = "N/A";
      if (signer.signature_city || signer.signature_state) {
        locationStr = [signer.signature_city, signer.signature_state].filter(Boolean).join(", ");
        if (signer.signature_country) {
          locationStr += ` - ${signer.signature_country}`;
        }
      }
      // Truncate and normalize location
      const displayLocation = truncateText(locationStr, 30);
      
      page.drawText(`Local: ${displayLocation}`, {
        x: rightX,
        y: rightY,
        size: 9,
        font: helveticaFont,
        color: gray600,
      });
      rightY -= lineHeight;

      const shortSignatureId = signer.signature_id ? signer.signature_id.substring(0, 18) + "..." : "N/A";
      page.drawText(`ID: ${shortSignatureId}`, {
        x: rightX,
        y: rightY,
        size: 9,
        font: helveticaFont,
        color: gray600,
      });
      rightY -= lineHeight;

      page.drawText(`Data/Hora: ${signer.signed_at ? formatDate(signer.signed_at) : "N/A"}`, {
        x: rightX,
        y: rightY,
        size: 9,
        font: helveticaFont,
        color: gray600,
      });

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

    lastPage.drawText("Documento validado pelo sistema Eon Sign", {
      x: margin,
      y: footerY,
      size: 9,
      font: helveticaBold,
      color: gray600,
    });

    lastPage.drawText("Este documento possui validade jurídica conforme Lei n. 14.063/2020 e MP 2.200-2/2001", {
      x: margin,
      y: footerY - 12,
      size: 8,
      font: helveticaFont,
      color: gray600,
    });

    // Save PDF
    const pdfBytes = await pdfDoc.save();
    const base64Content = btoa(String.fromCharCode(...pdfBytes));

    console.log(`Generated signature report PDF, size: ${pdfBytes.length} bytes`);

    return new Response(JSON.stringify({
      success: true,
      pdfBase64: base64Content,
      pdfBytes: Array.from(pdfBytes),
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error generating signature report:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
