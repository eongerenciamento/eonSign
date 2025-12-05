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

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentId }: GenerateReportRequest = await req.json();
    console.log("Generating signature report for document:", documentId);

    const supabase = createClient(supabaseUrl, supabaseKey);
    const APP_URL = Deno.env.get("APP_URL") || "https://lbyoniuealghclfuahko.lovable.app";

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

    // Header background
    page.drawRectangle({
      x: 0,
      y: pageHeight - 70,
      width: pageWidth,
      height: 70,
      color: gray300,
    });

    // Try to add logo
    try {
      const logoResponse = await fetch(`${supabaseUrl}/storage/v1/object/public/email-assets/logo-eon-gray.png`);
      if (logoResponse.ok) {
        const logoBytes = await logoResponse.arrayBuffer();
        const logoImage = await pdfDoc.embedPng(new Uint8Array(logoBytes));
        const logoMaxHeight = 40;
        const logoScale = logoMaxHeight / logoImage.height;
        const logoWidth = logoImage.width * logoScale;
        page.drawImage(logoImage, {
          x: margin,
          y: pageHeight - 55,
          width: logoWidth,
          height: logoMaxHeight,
        });
      }
    } catch (e) {
      console.log("Could not load logo:", e);
    }

    // Title
    page.drawText("RELATÓRIO DE ASSINATURAS", {
      x: pageWidth - margin - helveticaBold.widthOfTextAtSize("RELATÓRIO DE ASSINATURAS", 16),
      y: pageHeight - 45,
      size: 16,
      font: helveticaBold,
      color: gray600,
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

    page.drawText(`Documento: ${document.name}`, {
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

      // Signer name
      page.drawText(signer.name || "N/A", {
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

      page.drawText(`E-mail: ${signer.email || "N/A"}`, {
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
      page.drawText(`Local: ${locationStr}`, {
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
