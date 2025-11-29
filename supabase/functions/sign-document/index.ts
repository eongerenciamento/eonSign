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
    const { documentId, signerId, cpf } = await req.json();

    console.log("Processing signature:", { documentId, signerId, cpf });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Atualizar signatário
    const { error: signerError } = await supabase
      .from("document_signers")
      .update({
        cpf: cpf,
        status: "signed",
        signed_at: new Date().toISOString(),
      })
      .eq("id", signerId);

    if (signerError) {
      console.error("Error updating signer:", signerError);
      return new Response(JSON.stringify({ error: "Erro ao processar assinatura" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verificar se todos assinaram
    const { data: signers, error: signersError } = await supabase
      .from("document_signers")
      .select("status")
      .eq("document_id", documentId);

    if (signersError) {
      console.error("Error fetching signers:", signersError);
    }

    const signedCount = signers?.filter(s => s.status === "signed").length || 0;
    const allSigned = signedCount === signers?.length;

    console.log("Signature count:", { signedCount, totalSigners: signers?.length, allSigned });

    // Atualizar contagem no documento
    const { error: docError } = await supabase
      .from("documents")
      .update({
        signed_by: signedCount,
        status: allSigned ? "signed" : "pending",
      })
      .eq("id", documentId);

    if (docError) {
      console.error("Error updating document:", docError);
    }

    console.log("Signature processed successfully");

    return new Response(
      JSON.stringify({ success: true, allSigned }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in sign-document:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
