import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Função para validar CPF
const validateCPF = (cpf: string): boolean => {
  // Remove caracteres não numéricos
  const cleanCpf = cpf.replace(/\D/g, "");
  
  // CPF deve ter 11 dígitos
  if (cleanCpf.length !== 11) return false;
  
  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1+$/.test(cleanCpf)) return false;
  
  // Validação do primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCpf.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCpf.charAt(9))) return false;
  
  // Validação do segundo dígito verificador
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
  // Remove caracteres não numéricos
  const cleanCnpj = cnpj.replace(/\D/g, "");
  
  // CNPJ deve ter 14 dígitos
  if (cleanCnpj.length !== 14) return false;
  
  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1+$/.test(cleanCnpj)) return false;
  
  // Validação do primeiro dígito verificador
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
  
  // Validação do segundo dígito verificador
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

// Função para validar CPF ou CNPJ
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
    const { documentId, signerId, cpf, birthDate, latitude, longitude } = await req.json();

    // Validar entrada
    if (!documentId || !signerId || !cpf || !birthDate) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios não fornecidos" }), 
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validar formato de data
    const birthDateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!birthDateRegex.test(birthDate)) {
      return new Response(
        JSON.stringify({ error: "Formato de data inválido" }), 
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validar idade mínima (18 anos)
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
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Processing signature:", { documentId, signerId, cpf, birthDate });

    // Validar CPF/CNPJ
    const validation = validateCpfCnpj(cpf);
    if (!validation.valid) {
      console.error("Invalid CPF/CNPJ:", cpf);
      return new Response(
        JSON.stringify({ 
          error: `${validation.type || "CPF/CNPJ"} inválido. Por favor, verifique o número informado.` 
        }), 
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Valid ${validation.type} provided`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Obter localização via geocoding reverso se coordenadas foram fornecidas
    let city = null;
    let state = null;
    let country = null;

    if (latitude && longitude) {
      try {
        console.log(`Reverse geocoding coordinates: ${latitude}, ${longitude}`);
        const geoResponse = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=pt-BR`,
          {
            headers: {
              'User-Agent': 'EonSign/1.0'
            }
          }
        );
        
        if (geoResponse.ok) {
          const geoData = await geoResponse.json();
          city = geoData.address?.city || geoData.address?.town || geoData.address?.village || null;
          state = geoData.address?.state || null;
          country = geoData.address?.country || null;
          console.log("Location resolved:", { city, state, country });
        } else {
          console.warn("Geocoding failed, continuing without location");
        }
      } catch (geoError) {
        console.error("Error in reverse geocoding:", geoError);
      }
    }

    // Atualizar signatário
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

        // Buscar emails e telefones de todos os signatários
        const { data: allSigners } = await supabase
          .from("document_signers")
          .select("email, phone, name")
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

          // Enviar WhatsApp para cada signatário
          for (const signer of allSigners) {
            try {
              await supabase.functions.invoke('send-whatsapp-message', {
                body: {
                  signerName: signer.name,
                  signerPhone: signer.phone,
                  documentName: document.name,
                  documentId,
                  organizationName: companySettings?.admin_name || "Éon Sign",
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
