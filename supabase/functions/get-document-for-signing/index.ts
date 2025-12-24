import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentId, signerEmail } = await req.json();

    console.log("Fetching document for signing:", { documentId, signerEmail });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Buscar documento (including require_facial_biometry field)
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("*, require_facial_biometry")
      .eq("id", documentId)
      .single();

    if (docError || !document) {
      console.error("Document not found:", docError);
      return new Response(JSON.stringify({ error: "Documento não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if document was cancelled
    if (document.status === "cancelled") {
      console.log("Document was cancelled:", documentId);
      return new Response(JSON.stringify({ error: "cancelled", message: "Este documento foi cancelado" }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gerar URL assinada temporária para o documento
    let documentWithSignedUrl = document;
    
    // Determine which file to use - signed version if available, otherwise original
    let filePathToUse: string | null = null;
    
    if (document.bry_signed_file_url) {
      // Use the signed document path
      filePathToUse = document.bry_signed_file_url;
      console.log("Using signed document:", filePathToUse);
    } else if (document.file_url) {
      // Extract path from original URL
      filePathToUse = document.file_url.split('/documents/').pop() || null;
      console.log("Using original document, extracted path:", filePathToUse);
    }
    
    if (filePathToUse) {
      try {
        // Gerar URL assinada com validade de 1 hora (3600 segundos)
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from('documents')
          .createSignedUrl(filePathToUse, 3600);

        if (signedUrlError) {
          console.error("Error creating signed URL:", signedUrlError);
        } else {
          console.log("Signed URL generated successfully");
          documentWithSignedUrl = {
            ...document,
            file_url: signedUrlData.signedUrl
          };
        }
      } catch (error) {
        console.error("Error processing file URL:", error);
      }
    }

    // Buscar signatários
    const { data: signers, error: signersError } = await supabase
      .from("document_signers")
      .select("*")
      .eq("document_id", documentId)
      .order("is_company_signer", { ascending: false });

    if (signersError) {
      console.error("Error fetching signers:", signersError);
    }

    // Verificar se o email é de um signatário válido
    const currentSigner = signers?.find(s => s.email === signerEmail);

    console.log("Document fetched successfully:", { 
      documentName: documentWithSignedUrl.name, 
      signersCount: signers?.length,
      currentSignerFound: !!currentSigner 
    });

    return new Response(
      JSON.stringify({ document: documentWithSignedUrl, signers, currentSigner }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in get-document-for-signing:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
