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

    // Se todos assinaram, enviar email de confirmação
    if (allSigned) {
      console.log("All signatures completed, sending confirmation emails");
      
      // Buscar informações do documento e signatários
      const { data: document, error: docDataError } = await supabase
        .from("documents")
        .select("name, user_id")
        .eq("id", documentId)
        .single();

      if (!docDataError && document) {
        // Buscar configurações da empresa para pegar o nome do remetente
        const { data: companySettings } = await supabase
          .from("company_settings")
          .select("admin_name")
          .eq("user_id", document.user_id)
          .single();

        // Buscar emails de todos os signatários
        const { data: allSigners } = await supabase
          .from("document_signers")
          .select("email")
          .eq("document_id", documentId);

        if (allSigners && allSigners.length > 0) {
          const signerEmails = allSigners.map(s => s.email);
          const senderName = companySettings?.admin_name || "Éon Sign";

          // Chamar função para enviar emails
          try {
            await supabase.functions.invoke('send-document-completed-email', {
              body: {
                documentId,
                documentName: document.name,
                signerEmails,
                senderName
              }
            });
            console.log("Confirmation emails sent successfully");
          } catch (emailError) {
            console.error("Error sending confirmation emails:", emailError);
          }
        }
      }
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
