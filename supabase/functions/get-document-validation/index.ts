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
      .select("id, name, status, signature_mode, created_at, updated_at, signers, signed_by, user_id, bry_signed_file_url")
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
        cpf,
        selfie_url
      `)
      .eq("document_id", documentId)
      .order("signed_at", { ascending: true });

    if (signersError) {
      console.error("Error fetching signers:", signersError);
    }

    // Mask CPF and generate signed URLs for selfies
    const maskedSigners = await Promise.all((signers || []).map(async (signer) => {
      let maskedCpf = null;
      if (signer.cpf) {
        const clean = signer.cpf.replace(/\D/g, "");
        if (clean.length === 11) {
          maskedCpf = `***.***.*${clean.slice(7, 9)}-${clean.slice(9)}`;
        } else if (clean.length === 14) {
          maskedCpf = `**.***.***/***${clean.slice(10, 12)}-${clean.slice(12)}`;
        }
      }

      // Generate signed URL for selfie if exists (biometry bucket is private)
      let selfieSignedUrl = null;
      if (signer.selfie_url) {
        try {
          let filePath = signer.selfie_url;
          // Handle both URL and path formats
          if (filePath.includes('/biometry/')) {
            const urlParts = filePath.split('/biometry/');
            filePath = decodeURIComponent(urlParts[urlParts.length - 1].split('?')[0]);
          }
          
          const { data: selfieUrlData } = await supabase.storage
            .from("biometry")
            .createSignedUrl(filePath, 3600); // 1 hour expiry
          
          if (selfieUrlData?.signedUrl) {
            selfieSignedUrl = selfieUrlData.signedUrl;
          }
        } catch (e) {
          console.error("Error generating selfie signed URL:", e);
        }
      }

      return {
        ...signer,
        cpf: maskedCpf,
        selfie_url: selfieSignedUrl
      };
    }));

    const isCompleted = document.status === "signed";
    const isValid = isCompleted && document.signed_by === document.signers;

    // Determine timestamp info based on signature mode
    const hasTimestamp = ['ADVANCED', 'QUALIFIED'].includes(document.signature_mode || '');
    const timestampInfo = hasTimestamp ? {
      applied: isCompleted,
      profile: document.signature_mode === 'QUALIFIED' ? 'ICP-Brasil (Qualificado)' : 'Avançado',
      authority: 'BRy Tecnologia - Autoridade de Carimbo do Tempo (ACT)',
      standard: 'RFC 3161',
      legalBasis: 'Lei n. 14.063/2020'
    } : null;

    // Generate signed URL for download if document is completed
    let downloadUrl = null;
    if (isCompleted && document.bry_signed_file_url) {
      let filePath = document.bry_signed_file_url;
      // Handle both URL and path formats
      if (filePath.includes('/documents/')) {
        const urlParts = filePath.split('/documents/');
        filePath = decodeURIComponent(urlParts[urlParts.length - 1].split('?')[0]);
      }
      
      const { data: signedUrlData } = await supabase.storage
        .from("documents")
        .createSignedUrl(filePath, 3600); // 1 hour expiry
      
      if (signedUrlData?.signedUrl) {
        downloadUrl = signedUrlData.signedUrl;
      }
    }

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
          signedCount: document.signed_by,
          downloadUrl,
          hasTimestamp,
          timestampInfo
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
