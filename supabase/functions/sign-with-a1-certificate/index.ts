import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SignRequest {
  documentId: string;
  certificateBase64: string;
  certificatePassword: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authorization header missing");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { documentId, certificateBase64, certificatePassword }: SignRequest = await req.json();

    console.log("[A1 Sign] Processing document:", documentId);

    // Get document info
    const { data: docData, error: docError } = await supabase
      .from("documents")
      .select("id, name, file_url, user_id")
      .eq("id", documentId)
      .single();

    if (docError || !docData) {
      console.error("[A1 Sign] Document not found:", docError);
      throw new Error("Documento não encontrado");
    }

    // Verify user owns the document
    if (docData.user_id !== user.id) {
      throw new Error("Você não tem permissão para assinar este documento");
    }

    // Get the PDF from storage
    if (!docData.file_url) {
      throw new Error("Arquivo do documento não encontrado");
    }

    // Extract bucket and path from file_url
    const urlParts = docData.file_url.split("/");
    const bucketIndex = urlParts.indexOf("object") + 2;
    const bucket = urlParts[bucketIndex];
    const filePath = urlParts.slice(bucketIndex + 1).join("/");

    console.log("[A1 Sign] Downloading PDF from:", bucket, filePath);

    const { data: fileData, error: fileError } = await supabase.storage
      .from(bucket)
      .download(filePath);

    if (fileError || !fileData) {
      console.error("[A1 Sign] Error downloading file:", fileError);
      throw new Error("Erro ao baixar o documento");
    }

    // Convert PDF to base64
    const pdfArrayBuffer = await fileData.arrayBuffer();
    const pdfBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfArrayBuffer)));

    console.log("[A1 Sign] PDF downloaded, size:", pdfArrayBuffer.byteLength);

    // Call BRy API to sign with A1 certificate
    // First, get auth token
    const bryClientId = Deno.env.get("BRY_CLIENT_ID");
    const bryClientSecret = Deno.env.get("BRY_CLIENT_SECRET");
    
    if (!bryClientId || !bryClientSecret) {
      console.error("[A1 Sign] BRy credentials not configured");
      throw new Error("Configuração de assinatura não disponível");
    }

    // Get BRy token
    const tokenResponse = await fetch("https://api-hml.bfrcloud.com/auth/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: bryClientId,
        client_secret: bryClientSecret,
      }),
    });

    if (!tokenResponse.ok) {
      console.error("[A1 Sign] Failed to get BRy token");
      throw new Error("Erro ao autenticar com serviço de assinatura");
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    console.log("[A1 Sign] Got BRy token, proceeding with signature");

    // Sign the document with A1 certificate using BRy API
    const signResponse = await fetch("https://api-hml.bfrcloud.com/fw/v1/pdf/assinar", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pdf: pdfBase64,
        certificado: certificateBase64,
        senha: certificatePassword,
        perfil: ["CADES_AD_RB", "TIMESTAMP"],
        paginaCarimbo: -1, // Last page
      }),
    });

    if (!signResponse.ok) {
      const errorText = await signResponse.text();
      console.error("[A1 Sign] Signature failed:", errorText);
      
      // Check for specific errors
      if (errorText.includes("senha") || errorText.includes("password")) {
        throw new Error("Senha do certificado incorreta");
      }
      if (errorText.includes("certificado") || errorText.includes("certificate")) {
        throw new Error("Certificado inválido ou expirado");
      }
      
      throw new Error("Erro ao assinar documento");
    }

    const signResult = await signResponse.json();
    const signedPdfBase64 = signResult.pdf;

    console.log("[A1 Sign] Document signed successfully");

    // Convert signed PDF back to blob
    const signedPdfBytes = Uint8Array.from(atob(signedPdfBase64), (c) => c.charCodeAt(0));
    const signedPdfBlob = new Blob([signedPdfBytes], { type: "application/pdf" });

    // Upload signed PDF to storage
    const signedFileName = filePath.replace(".pdf", "_assinado.pdf");
    
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(signedFileName, signedPdfBlob, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("[A1 Sign] Error uploading signed PDF:", uploadError);
      throw new Error("Erro ao salvar documento assinado");
    }

    // Get public URL for the signed file
    const { data: signedFileUrl } = supabase.storage
      .from(bucket)
      .getPublicUrl(signedFileName);

    // Update document status
    const { error: updateError } = await supabase
      .from("documents")
      .update({
        status: "completed",
        signed_by: 1,
        bry_signed_file_url: signedFileUrl.publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    if (updateError) {
      console.error("[A1 Sign] Error updating document:", updateError);
    }

    // Update signer status
    await supabase
      .from("document_signers")
      .update({
        status: "signed",
        signed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("document_id", documentId)
      .eq("is_company_signer", true);

    console.log("[A1 Sign] Document updated successfully");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Documento assinado com sucesso",
        signedFileUrl: signedFileUrl.publicUrl 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("[A1 Sign] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || "Erro ao assinar documento" 
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
