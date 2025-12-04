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
    const { documentId } = await req.json();

    if (!documentId) {
      return new Response(
        JSON.stringify({ error: "ID do documento não fornecido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch document info
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("id, name, status, signature_mode, created_at, updated_at, signers, signed_by, user_id")
      .eq("id", documentId)
      .single();

    if (docError || !document) {
      console.error("Document not found:", docError);
      return new Response(
        JSON.stringify({ error: "Documento não encontrado", valid: false }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch company/organization info
    const { data: companySettings } = await supabase
      .from("company_settings")
      .select("company_name, logo_url")
      .eq("user_id", document.user_id)
      .single();

    // Fetch signers info (excluding sensitive data)
    const { data: signers, error: signersError } = await supabase
      .from("document_signers")
      .select(`
        id,
        name,
        status,
        signed_at,
        signature_ip,
        signature_city,
        signature_state,
        signature_country,
        signature_id,
        cpf
      `)
      .eq("document_id", documentId)
      .order("signed_at", { ascending: true });

    if (signersError) {
      console.error("Error fetching signers:", signersError);
    }

    // Mask CPF for privacy (show only last 4 digits)
    const maskedSigners = signers?.map(signer => {
      let maskedCpf = null;
      if (signer.cpf) {
        const clean = signer.cpf.replace(/\D/g, "");
        if (clean.length === 11) {
          maskedCpf = `***.***.*${clean.slice(7, 9)}-${clean.slice(9)}`;
        } else if (clean.length === 14) {
          maskedCpf = `**.***.***/***${clean.slice(10, 12)}-${clean.slice(12)}`;
        }
      }
      return {
        ...signer,
        cpf: maskedCpf
      };
    });

    const isCompleted = document.status === "signed";
    const isValid = isCompleted && document.signed_by === document.signers;

    return new Response(
      JSON.stringify({
        valid: isValid,
        document: {
          id: document.id,
          name: document.name,
          status: document.status,
          signatureMode: document.signature_mode,
          createdAt: document.created_at,
          completedAt: isCompleted ? document.updated_at : null,
          totalSigners: document.signers,
          signedCount: document.signed_by
        },
        organization: {
          name: companySettings?.company_name || "Organização",
          logoUrl: companySettings?.logo_url || null
        },
        signers: maskedSigners || []
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in get-document-validation:", error);
    return new Response(
      JSON.stringify({ error: error.message, valid: false }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
