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
      allSignersData, // New: array of all signers when all have signed
      isLastSigner    // New: flag to indicate this is the last signer
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

    // Determine which PDF to use: already signed version or original
    const sourceUrl = document.bry_signed_file_url || document.file_url;
    console.log("Source URL for signature:", sourceUrl);

    // Extract file path from URL
    let filePath: string;
    if (sourceUrl.includes('/documents/')) {
      // Extract path after /documents/
      const urlParts = sourceUrl.split('/documents/');
      filePath = decodeURIComponent(urlParts[urlParts.length - 1].split('?')[0]);
    } else {
      console.error("Invalid file URL format:", sourceUrl);
      return new Response(
        JSON.stringify({ error: "URL do arquivo inválida" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Downloading PDF from storage path:", filePath);

    // Download PDF via Supabase Storage (works with private bucket)
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
    
    // Get the page for signature (default to last page)
    const pageIndex = Math.min(Math.max(0, (signaturePage || totalPages) - 1), totalPages - 1);
    const page = pages[pageIndex];
    const { width, height } = page.getSize();

    // Embed fonts
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Calculate signature position (convert percentage to absolute)
    const sigX = signatureX ? (signatureX / 100) * width : 50;
    const sigY = signatureY ? height - ((signatureY / 100) * height) : height - 200;

    // Draw signature box
    const signatureBoxWidth = 250;
    const signatureBoxHeight = 80;
    
    // Background box for signature
    page.drawRectangle({
      x: sigX,
      y: sigY - signatureBoxHeight,
      width: signatureBoxWidth,
      height: signatureBoxHeight,
      color: rgb(0.98, 0.98, 0.98),
      borderColor: rgb(0.7, 0.7, 0.7),
      borderWidth: 1,
    });

    // Draw typed signature (simulating cursive)
    page.drawText(typedSignature || signerData.name, {
      x: sigX + 10,
      y: sigY - 35,
      size: 24,
      font: helveticaBold,
      color: rgb(0.1, 0.1, 0.3),
    });

    // Draw signature label
    page.drawText("Assinatura Eletrônica", {
      x: sigX + 10,
      y: sigY - 55,
      size: 8,
      font: helveticaFont,
      color: rgb(0.4, 0.4, 0.4),
    });

    // Draw date
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

    // If this is the last signer, add a full validation page
    if (isLastSigner && allSignersData && allSignersData.length > 0) {
      console.log("Adding validation page with all signers data");
      
      // Create a new A4 page for validation
      const validationPage = pdfDoc.addPage([595.28, 841.89]);
      
      // Header
      validationPage.drawRectangle({
        x: 0,
        y: 770,
        width: 595.28,
        height: 71.89,
        color: rgb(0.153, 0.239, 0.376), // #273d60
      });

      validationPage.drawText("PÁGINA DE VALIDAÇÃO", {
        x: 50,
        y: 800,
        size: 22,
        font: helveticaBold,
        color: rgb(1, 1, 1),
      });

      validationPage.drawText("ASSINATURAS ELETRÔNICAS", {
        x: 50,
        y: 778,
        size: 14,
        font: helveticaFont,
        color: rgb(0.9, 0.9, 0.9),
      });

      // Document info
      let currentY = 740;
      
      validationPage.drawText(`Documento: ${document.name}`, {
        x: 50,
        y: currentY,
        size: 11,
        font: helveticaBold,
        color: rgb(0.2, 0.2, 0.2),
      });
      currentY -= 20;

      validationPage.drawText(`Data de conclusão: ${signDate}`, {
        x: 50,
        y: currentY,
        size: 10,
        font: helveticaFont,
        color: rgb(0.3, 0.3, 0.3),
      });
      currentY -= 30;

      // Separator line
      validationPage.drawLine({
        start: { x: 50, y: currentY },
        end: { x: 545, y: currentY },
        thickness: 1,
        color: rgb(0.8, 0.8, 0.8),
      });
      currentY -= 25;

      // Draw each signer's information
      for (let i = 0; i < allSignersData.length; i++) {
        const signer = allSignersData[i];
        
        // Check if we need a new page
        if (currentY < 150) {
          const newPage = pdfDoc.addPage([595.28, 841.89]);
          currentY = 800;
        }

        // Signer box header
        validationPage.drawRectangle({
          x: 40,
          y: currentY - 5,
          width: 515,
          height: 25,
          color: rgb(0.95, 0.95, 0.95),
        });

        validationPage.drawText(`SIGNATÁRIO ${i + 1}`, {
          x: 50,
          y: currentY,
          size: 11,
          font: helveticaBold,
          color: rgb(0.153, 0.239, 0.376),
        });
        currentY -= 30;

        // Signer details
        const lineHeight = 16;
        
        validationPage.drawText(`Nome: ${signer.name || "N/A"}`, {
          x: 50,
          y: currentY,
          size: 10,
          font: helveticaFont,
          color: rgb(0.2, 0.2, 0.2),
        });
        currentY -= lineHeight;

        validationPage.drawText(`CPF/CNPJ: ${formatCpf(signer.cpf)}`, {
          x: 50,
          y: currentY,
          size: 10,
          font: helveticaFont,
          color: rgb(0.2, 0.2, 0.2),
        });
        currentY -= lineHeight;

        validationPage.drawText(`Data de Nascimento: ${formatDate(signer.birth_date)}`, {
          x: 50,
          y: currentY,
          size: 10,
          font: helveticaFont,
          color: rgb(0.2, 0.2, 0.2),
        });
        currentY -= lineHeight;

        validationPage.drawText(`E-mail: ${signer.email || "N/A"}`, {
          x: 50,
          y: currentY,
          size: 10,
          font: helveticaFont,
          color: rgb(0.2, 0.2, 0.2),
        });
        currentY -= lineHeight;

        validationPage.drawText(`Telefone: ${formatPhone(signer.phone)}`, {
          x: 50,
          y: currentY,
          size: 10,
          font: helveticaFont,
          color: rgb(0.2, 0.2, 0.2),
        });
        currentY -= lineHeight;

        validationPage.drawText(`IP: ${signer.signature_ip || "N/A"}`, {
          x: 50,
          y: currentY,
          size: 10,
          font: helveticaFont,
          color: rgb(0.2, 0.2, 0.2),
        });
        currentY -= lineHeight;

        // Build location string
        let locationStr = "N/A";
        if (signer.signature_city || signer.signature_state) {
          locationStr = [signer.signature_city, signer.signature_state].filter(Boolean).join(", ");
          if (signer.signature_country) {
            locationStr += ` - ${signer.signature_country}`;
          }
        }
        
        validationPage.drawText(`Geolocalização: ${locationStr}`, {
          x: 50,
          y: currentY,
          size: 10,
          font: helveticaFont,
          color: rgb(0.2, 0.2, 0.2),
        });
        currentY -= lineHeight;

        validationPage.drawText(`ID da Autenticação: ${signer.signature_id || "N/A"}`, {
          x: 50,
          y: currentY,
          size: 10,
          font: helveticaFont,
          color: rgb(0.2, 0.2, 0.2),
        });
        currentY -= lineHeight;

        validationPage.drawText(`Data/Hora da Assinatura: ${formatDateTime(signer.signed_at)}`, {
          x: 50,
          y: currentY,
          size: 10,
          font: helveticaFont,
          color: rgb(0.2, 0.2, 0.2),
        });
        currentY -= 30;

        // Separator between signers
        if (i < allSignersData.length - 1) {
          validationPage.drawLine({
            start: { x: 50, y: currentY + 10 },
            end: { x: 545, y: currentY + 10 },
            thickness: 0.5,
            color: rgb(0.85, 0.85, 0.85),
            dashArray: [3, 3],
          });
          currentY -= 15;
        }
      }

      // Footer
      validationPage.drawLine({
        start: { x: 50, y: 60 },
        end: { x: 545, y: 60 },
        thickness: 1,
        color: rgb(0.8, 0.8, 0.8),
      });

      validationPage.drawText("Documento validado pelo sistema Eon Sign", {
        x: 50,
        y: 42,
        size: 9,
        font: helveticaBold,
        color: rgb(0.4, 0.4, 0.4),
      });

      validationPage.drawText("Este documento possui validade jurídica conforme Lei nº 14.063/2020", {
        x: 50,
        y: 28,
        size: 8,
        font: helveticaFont,
        color: rgb(0.5, 0.5, 0.5),
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
        signedFilePath: signedFilePath, // Return path for storage
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
