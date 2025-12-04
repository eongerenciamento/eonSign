import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Função para validar CPF
const validateCPF = (cpf: string): boolean => {
  const cleanCpf = cpf.replace(/\D/g, "");
  if (cleanCpf.length !== 11) return false;
  if (/^(\d)\1+$/.test(cleanCpf)) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCpf.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCpf.charAt(9))) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCpf.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCpf.charAt(10))) return false;
  
  return true;
};

// Função para validar CNPJ
const validateCNPJ = (cnpj: string): boolean => {
  const cleanCnpj = cnpj.replace(/\D/g, "");
  if (cleanCnpj.length !== 14) return false;
  if (/^(\d)\1+$/.test(cleanCnpj)) return false;
  
  let size = cleanCnpj.length - 2;
  let numbers = cleanCnpj.substring(0, size);
  const digits = cleanCnpj.substring(size);
  let sum = 0;
  let pos = size - 7;
  
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) return false;
  
  size = size + 1;
  numbers = cleanCnpj.substring(0, size);
  sum = 0;
  pos = size - 7;
  
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1))) return false;
  
  return true;
};

const validateCpfCnpj = (value: string): { valid: boolean; type: "CPF" | "CNPJ" | null } => {
  const clean = value.replace(/\D/g, "");
  if (clean.length === 11) {
    return { valid: validateCPF(clean), type: "CPF" };
  } else if (clean.length === 14) {
    return { valid: validateCNPJ(clean), type: "CNPJ" };
  }
  return { valid: false, type: null };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
                     req.headers.get('x-real-ip') ||
                     req.headers.get('cf-connecting-ip') ||
                     null;
    
    console.log("Client IP:", clientIp);

    const { 
      documentId, 
      signerId, 
      cpf, 
      birthDate, 
      latitude, 
      longitude,
      // New fields for simple signature
      typedSignature,
      signatureX,
      signatureY,
      signaturePage
    } = await req.json();

    if (!documentId || !signerId || !cpf || !birthDate) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios não fornecidos" }), 
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const birthDateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!birthDateRegex.test(birthDate)) {
      return new Response(
        JSON.stringify({ error: "Formato de data inválido" }), 
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    if (age < 18) {
      return new Response(
        JSON.stringify({ error: "Signatário deve ter pelo menos 18 anos" }), 
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Processing signature:", { documentId, signerId, cpf, birthDate });

    const validation = validateCpfCnpj(cpf);
    if (!validation.valid) {
      console.error("Invalid CPF/CNPJ:", cpf);
      return new Response(
        JSON.stringify({ error: `${validation.type || "CPF/CNPJ"} inválido. Por favor, verifique o número informado.` }), 
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Valid ${validation.type} provided`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get document to check signature mode
    const { data: document, error: docFetchError } = await supabase
      .from("documents")
      .select("signature_mode, name, user_id")
      .eq("id", documentId)
      .single();

    if (docFetchError || !document) {
      console.error("Document not found:", docFetchError);
      return new Response(
        JSON.stringify({ error: "Documento não encontrado" }), 
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get signer info
    const { data: signerInfo, error: signerFetchError } = await supabase
      .from("document_signers")
      .select("name, email, phone")
      .eq("id", signerId)
      .single();

    if (signerFetchError || !signerInfo) {
      console.error("Signer not found:", signerFetchError);
      return new Response(
        JSON.stringify({ error: "Signatário não encontrado" }), 
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate unique signature ID
    const signatureId = crypto.randomUUID();

    // Reverse geocoding for location
    let city = null;
    let state = null;
    let country = null;

    if (latitude && longitude) {
      try {
        console.log(`Reverse geocoding coordinates: ${latitude}, ${longitude}`);
        const geoResponse = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=pt-BR`,
          { headers: { 'User-Agent': 'EonSign/1.0' } }
        );
        
        if (geoResponse.ok) {
          const geoData = await geoResponse.json();
          city = geoData.address?.city || geoData.address?.town || geoData.address?.village || null;
          state = geoData.address?.state || null;
          country = geoData.address?.country || null;
          console.log("Location resolved:", { city, state, country });
        }
      } catch (geoError) {
        console.error("Error in reverse geocoding:", geoError);
      }
    }

    // Check if this is a SIMPLE signature (native flow)
    const isSimpleSignature = document.signature_mode === "SIMPLE" || !document.signature_mode;

    let signedFileUrl = null;

    if (isSimpleSignature) {
      console.log("Processing SIMPLE signature - native flow");

      // Call apply-simple-signature to process the PDF
      try {
        const { data: signatureResult, error: signatureError } = await supabase.functions.invoke(
          "apply-simple-signature",
          {
            body: {
              documentId,
              signerId,
              typedSignature: typedSignature || signerInfo.name,
              signatureX: signatureX || 50,
              signatureY: signatureY || 80,
              signaturePage: signaturePage || 1,
              signerData: {
                name: signerInfo.name,
                email: signerInfo.email,
                phone: signerInfo.phone,
                cpf: cpf,
                ip: clientIp,
                city,
                state,
                country,
                signatureId
              }
            }
          }
        );

        if (signatureError) {
          console.error("Error applying simple signature:", signatureError);
        } else if (signatureResult?.signedFileUrl) {
          signedFileUrl = signatureResult.signedFileUrl;
          console.log("Simple signature applied, signed URL:", signedFileUrl);
        }
      } catch (sigErr) {
        console.error("Error invoking apply-simple-signature:", sigErr);
      }
    }

    // Update signer record
    const { error: signerError } = await supabase
      .from("document_signers")
      .update({
        cpf: cpf,
        birth_date: birthDate,
        status: "signed",
        signed_at: new Date().toISOString(),
        signature_latitude: latitude,
        signature_longitude: longitude,
        signature_city: city,
        signature_state: state,
        signature_country: country,
        signature_ip: clientIp,
        signature_id: signatureId,
        typed_signature: typedSignature || signerInfo.name,
        signature_x: signatureX,
        signature_y: signatureY,
        signature_page: signaturePage,
      })
      .eq("id", signerId);

    if (signerError) {
      console.error("Error updating signer:", signerError);
      return new Response(
        JSON.stringify({ error: "Erro ao processar assinatura" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if all signers have signed
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

    // Update document
    const updateData: any = {
      signed_by: signedCount,
      status: allSigned ? "signed" : "pending",
    };

    // Only update signed file URL for simple signatures when all have signed
    if (isSimpleSignature && allSigned && signedFileUrl) {
      updateData.bry_signed_file_url = signedFileUrl;
    }

    const { error: docError } = await supabase
      .from("documents")
      .update(updateData)
      .eq("id", documentId);

    if (docError) {
      console.error("Error updating document:", docError);
    }

    // If all signed, send notifications
    if (allSigned) {
      console.log("All signatures completed, sending confirmation emails");
      
      const { data: companySettings } = await supabase
        .from("company_settings")
        .select("admin_name")
        .eq("user_id", document.user_id)
        .single();

      const { data: allSigners } = await supabase
        .from("document_signers")
        .select("email, phone, name")
        .eq("document_id", documentId);

      if (allSigners && allSigners.length > 0) {
        const signerEmails = allSigners.map(s => s.email);
        const senderName = companySettings?.admin_name || "Eon Sign";

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

        for (const signer of allSigners) {
          try {
            await supabase.functions.invoke('send-whatsapp-message', {
              body: {
                signerName: signer.name,
                signerPhone: signer.phone,
                documentName: document.name,
                documentId,
                organizationName: companySettings?.admin_name || "Eon Sign",
                isCompleted: true
              }
            });
            console.log(`WhatsApp confirmation sent to ${signer.phone}`);
          } catch (whatsappError) {
            console.error(`Error sending WhatsApp to ${signer.phone}:`, whatsappError);
          }
        }
      }
    }

    console.log("Signature processed successfully");

    return new Response(
      JSON.stringify({ success: true, allSigned, signatureId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in sign-document:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});