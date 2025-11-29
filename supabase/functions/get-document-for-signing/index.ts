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

    // Buscar documento
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (docError || !document) {
      console.error("Document not found:", docError);
      return new Response(JSON.stringify({ error: "Documento não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      documentName: document.name, 
      signersCount: signers?.length,
      currentSignerFound: !!currentSigner 
    });

    return new Response(
      JSON.stringify({ document, signers, currentSigner }),
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
