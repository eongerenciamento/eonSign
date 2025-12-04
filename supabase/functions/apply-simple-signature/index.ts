import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
      signerData
    } = await req.json();

    console.log("Processing simple signature for document:", documentId);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get document info
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("file_url, name, user_id")
      .eq("id", documentId)
      .single();

    if (docError || !document) {
      console.error("Document not found:", docError);
      return new Response(
        JSON.stringify({ error: "Documento não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Download the original PDF
    console.log("Downloading original PDF from:", document.file_url);
    const pdfResponse = await fetch(document.file_url);
    if (!pdfResponse.ok) {
      throw new Error("Failed to download PDF");
    }
    const pdfBytes = await pdfResponse.arrayBuffer();

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

    // Add audit footer to the last page
    const lastPage = pages[totalPages - 1];
    const { width: lastWidth, height: lastHeight } = lastPage.getSize();
    
    // Footer background
    const footerHeight = 80;
    const footerY = 20;
    
    lastPage.drawRectangle({
      x: 20,
      y: footerY,
      width: lastWidth - 40,
      height: footerHeight,
      color: rgb(0.95, 0.95, 0.95),
      borderColor: rgb(0.8, 0.8, 0.8),
      borderWidth: 0.5,
    });

    // Format CPF for display
    const formatCpf = (cpf: string) => {
      const clean = cpf.replace(/\D/g, "");
      if (clean.length === 11) {
        return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9)}`;
      } else if (clean.length === 14) {
        return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 8)}/${clean.slice(8, 12)}-${clean.slice(12)}`;
      }
      return cpf;
    };

    // Format phone for display
    const formatPhone = (phone: string) => {
      const clean = phone.replace(/\D/g, "");
      if (clean.length === 11) {
        return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
      }
      return phone;
    };

    // Footer text
    const lineHeight = 11;
    let currentY = footerY + footerHeight - 15;
    
    // Title line
    lastPage.drawText("REGISTRO DE ASSINATURA ELETRÔNICA", {
      x: 30,
      y: currentY,
      size: 9,
      font: helveticaBold,
      color: rgb(0.2, 0.2, 0.2),
    });
    currentY -= lineHeight;

    // Signer info line 1
    const line1 = `Assinado por: ${signerData.name} | CPF/CNPJ: ${formatCpf(signerData.cpf)}`;
    lastPage.drawText(line1, {
      x: 30,
      y: currentY,
      size: 8,
      font: helveticaFont,
      color: rgb(0.3, 0.3, 0.3),
    });
    currentY -= lineHeight;

    // Signer info line 2
    const line2 = `E-mail: ${signerData.email} | Telefone: ${formatPhone(signerData.phone || "")}`;
    lastPage.drawText(line2, {
      x: 30,
      y: currentY,
      size: 8,
      font: helveticaFont,
      color: rgb(0.3, 0.3, 0.3),
    });
    currentY -= lineHeight;

    // Location and IP line
    let locationStr = "";
    if (signerData.city && signerData.state) {
      locationStr = `${signerData.city}, ${signerData.state}`;
      if (signerData.country) locationStr += ` - ${signerData.country}`;
    }
    const line3 = `IP: ${signerData.ip || "N/A"} | Localização: ${locationStr || "N/A"}`;
    lastPage.drawText(line3, {
      x: 30,
      y: currentY,
      size: 8,
      font: helveticaFont,
      color: rgb(0.3, 0.3, 0.3),
    });
    currentY -= lineHeight;

    // Signature ID and date line
    const line4 = `ID da Assinatura: ${signerData.signatureId} | Data: ${signDate}`;
    lastPage.drawText(line4, {
      x: 30,
      y: currentY,
      size: 8,
      font: helveticaFont,
      color: rgb(0.3, 0.3, 0.3),
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

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("documents")
      .getPublicUrl(signedFilePath);

    console.log("Signed PDF uploaded to:", urlData.publicUrl);

    return new Response(
      JSON.stringify({
        success: true,
        signedFileUrl: urlData.publicUrl,
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