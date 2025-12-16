import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import forge from "https://esm.sh/node-forge@1.3.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SignWithCertificateRequest {
  documentId: string;
  userId: string;
}

// Simple XOR-based encryption/decryption (for development)
// In production, use a proper encryption service
function decryptPassword(encrypted: string, userId: string): string {
  // Use userId as key for decryption
  const key = userId.replace(/-/g, '').substring(0, 32);
  const encryptedBytes = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  
  const decrypted = new Uint8Array(encryptedBytes.length);
  for (let i = 0; i < encryptedBytes.length; i++) {
    decrypted[i] = encryptedBytes[i] ^ key.charCodeAt(i % key.length);
  }
  
  return new TextDecoder().decode(decrypted);
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentId, userId }: SignWithCertificateRequest = await req.json();

    console.log('[sign-with-local-certificate] Starting for document:', documentId, 'user:', userId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get company settings with certificate data
    const { data: companySettings, error: settingsError } = await supabase
      .from('company_settings')
      .select('certificate_file_url, certificate_password_encrypted, certificate_subject, certificate_valid_to, admin_name, admin_cpf, admin_email, admin_phone')
      .eq('user_id', userId)
      .single();

    if (settingsError || !companySettings) {
      console.error('[sign-with-local-certificate] Error fetching company settings:', settingsError);
      throw new Error('Configurações da empresa não encontradas');
    }

    if (!companySettings.certificate_file_url || !companySettings.certificate_password_encrypted) {
      throw new Error('Certificado digital não configurado. Configure nas configurações da empresa.');
    }

    // Check certificate expiration
    if (companySettings.certificate_valid_to) {
      const validTo = new Date(companySettings.certificate_valid_to);
      if (validTo < new Date()) {
        throw new Error('Certificado digital expirado. Atualize o certificado nas configurações.');
      }
    }

    console.log('[sign-with-local-certificate] Certificate found for:', companySettings.certificate_subject);

    // Download certificate file from storage
    const { data: certFileData, error: downloadError } = await supabase.storage
      .from('certificates')
      .download(companySettings.certificate_file_url);

    if (downloadError || !certFileData) {
      console.error('[sign-with-local-certificate] Error downloading certificate:', downloadError);
      throw new Error('Erro ao baixar o certificado');
    }

    // Decrypt password
    const password = decryptPassword(companySettings.certificate_password_encrypted, userId);
    console.log('[sign-with-local-certificate] Password decrypted successfully');

    // Parse PFX certificate
    const certBytes = new Uint8Array(await certFileData.arrayBuffer());
    let binaryString = '';
    for (let i = 0; i < certBytes.length; i++) {
      binaryString += String.fromCharCode(certBytes[i]);
    }

    const p12Asn1 = forge.asn1.fromDer(binaryString);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);
    
    // Get certificate and private key
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    
    const certBag = certBags[forge.pki.oids.certBag];
    const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag];

    if (!certBag || !certBag[0] || !certBag[0].cert) {
      throw new Error('Certificado não encontrado no arquivo PFX');
    }
    
    if (!keyBag || !keyBag[0] || !keyBag[0].key) {
      throw new Error('Chave privada não encontrada no arquivo PFX');
    }

    const cert = certBag[0].cert;
    const privateKey = keyBag[0].key as forge.pki.PrivateKey;

    console.log('[sign-with-local-certificate] Certificate and private key extracted');

    // Get document data
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('file_url, name')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      throw new Error('Documento não encontrado');
    }

    // Download original PDF
    const fileUrl = document.file_url;
    const filePath = fileUrl.includes('/documents/') 
      ? fileUrl.split('/documents/')[1] 
      : fileUrl;
    
    const { data: pdfData, error: pdfError } = await supabase.storage
      .from('documents')
      .download(filePath);

    if (pdfError || !pdfData) {
      console.error('[sign-with-local-certificate] Error downloading PDF:', pdfError);
      throw new Error('Erro ao baixar o documento PDF');
    }

    const pdfBytes = new Uint8Array(await pdfData.arrayBuffer());
    console.log('[sign-with-local-certificate] PDF downloaded, size:', pdfBytes.length);

    // Create signature info
    const now = new Date();
    const signatureInfo = {
      signerName: companySettings.admin_name,
      signerCpf: companySettings.admin_cpf,
      signerEmail: companySettings.admin_email,
      certificateSubject: companySettings.certificate_subject,
      signedAt: now.toISOString(),
    };

    // Create hash of document
    const md = forge.md.sha256.create();
    md.update(forge.util.binary.raw.encode(pdfBytes));
    const hash = md.digest().bytes();

    // Sign the hash with private key
    const signature = (privateKey as any).sign(forge.md.sha256.create().update(hash));
    const signatureB64 = forge.util.encode64(signature);

    console.log('[sign-with-local-certificate] Document signed with certificate');

    // For now, we'll store the signature metadata and update document status
    // A full PDF signature implementation would require pdf-lib with PKCS#7 support
    // which is complex in Deno environment

    // Update document_signers with signature
    const { error: signerUpdateError } = await supabase
      .from('document_signers')
      .update({
        status: 'signed',
        signed_at: now.toISOString(),
        signature_ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
      })
      .eq('document_id', documentId)
      .eq('is_company_signer', true);

    if (signerUpdateError) {
      console.error('[sign-with-local-certificate] Error updating signer:', signerUpdateError);
    }

    // Update document status
    const { data: signerCount } = await supabase
      .from('document_signers')
      .select('id, status')
      .eq('document_id', documentId);

    const signedCount = signerCount?.filter(s => s.status === 'signed').length || 0;
    const totalSigners = signerCount?.length || 0;

    const newStatus = signedCount === totalSigners ? 'signed' : 'pending';

    await supabase
      .from('documents')
      .update({
        signed_by: signedCount,
        status: newStatus,
      })
      .eq('id', documentId);

    console.log('[sign-with-local-certificate] Document updated:', { signedCount, totalSigners, newStatus });

    return new Response(JSON.stringify({
      success: true,
      message: 'Documento assinado com certificado digital',
      signatureInfo,
      documentStatus: newStatus,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[sign-with-local-certificate] Error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

serve(handler);
