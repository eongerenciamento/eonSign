import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Signer {
  name: string;
  email: string;
  phone: string;
}

interface DocumentInfo {
  documentId: string;
  base64: string;
  fileName: string;
}

// Available authentication options for BRy
type AuthenticationOption = 'IP' | 'GEOLOCATION' | 'OTP_EMAIL' | 'OTP_PHONE' | 'OTP_WHATSAPP' | 'SELFIE';

type SignatureMode = 'SIMPLE' | 'ADVANCED' | 'QUALIFIED';

interface CreateEnvelopeRequest {
  // Novo formato: múltiplos documentos
  documents?: DocumentInfo[];
  // Formato legado (retrocompatibilidade): documento único
  documentId?: string;
  documentBase64?: string;
  title: string;
  signers: Signer[];
  userId: string;
  authenticationOptions?: AuthenticationOption[];
  signatureMode?: SignatureMode;
}

async function getToken(): Promise<string> {
  const clientId = Deno.env.get('BRY_CLIENT_ID');
  const clientSecret = Deno.env.get('BRY_CLIENT_SECRET');
  const environment = Deno.env.get('BRY_ENVIRONMENT') || 'homologation';
  
  const baseUrl = environment === 'production' 
    ? 'https://cloud.bry.com.br'
    : 'https://cloud-hom.bry.com.br';

  console.log('Getting BRy token from:', baseUrl);

  const tokenResponse = await fetch(`${baseUrl}/token-service/jwt`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId!,
      client_secret: clientSecret!,
    }).toString(),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Failed to get BRy token: ${tokenResponse.status} - ${errorText}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData: CreateEnvelopeRequest = await req.json();
    const { title, signers, userId, authenticationOptions, signatureMode } = requestData;

    // Suportar formato novo (documents array) e legado (documentId + documentBase64)
    let documentsToProcess: DocumentInfo[] = [];
    
    if (requestData.documents && requestData.documents.length > 0) {
      // Novo formato: múltiplos documentos
      documentsToProcess = requestData.documents;
      console.log(`Creating BRy envelope with ${documentsToProcess.length} documents`);
    } else if (requestData.documentId && requestData.documentBase64) {
      // Formato legado: documento único
      documentsToProcess = [{
        documentId: requestData.documentId,
        base64: requestData.documentBase64,
        fileName: title,
      }];
      console.log('Creating BRy envelope with single document (legacy format)');
    } else {
      throw new Error('No documents provided');
    }

    console.log('Title:', title);
    console.log('Number of signers:', signers.length);
    console.log('Number of documents:', documentsToProcess.length);
    console.log('Authentication options:', authenticationOptions);
    console.log('Signature mode:', signatureMode || 'SIMPLE');

    // Obter token da BRy
    const accessToken = await getToken();
    console.log('BRy token obtained successfully');

    const environment = Deno.env.get('BRY_ENVIRONMENT') || 'homologation';
    const apiBaseUrl = environment === 'production'
      ? 'https://easysign.bry.com.br'
      : 'https://easysign.hom.bry.com.br';

    // Default authentication options if not provided
    const selectedAuthOptions: AuthenticationOption[] = authenticationOptions && authenticationOptions.length > 0 
      ? authenticationOptions 
      : ['IP', 'GEOLOCATION'];

    // Configurar signatureConfig baseado no modo selecionado
    const selectedSignatureMode = signatureMode || 'SIMPLE';
    
    // Preparar dados dos signatários para a BRy com formato E.164
    // signatureConfig deve estar DENTRO de cada signatário
    const signersData = signers.map(signer => {
      let phone = signer.phone ? signer.phone.replace(/\D/g, '') : '';
      
      // Configurar signatureConfig para este signatário
      const signerSignatureConfig: {
        mode: string;
        profile?: string;
      } = {
        mode: selectedSignatureMode,
      };
      
      // Para ADVANCED e QUALIFIED, adicionar perfil com timestamp
      if (selectedSignatureMode === 'ADVANCED' || selectedSignatureMode === 'QUALIFIED') {
        signerSignatureConfig.profile = 'TIMESTAMP';
      }
      
      const signerData: {
        name: string;
        email: string;
        phone?: string;
        authenticationOptions: AuthenticationOption[];
        signatureConfig: { mode: string; profile?: string };
      } = {
        name: signer.name,
        email: signer.email,
        authenticationOptions: selectedAuthOptions,
        signatureConfig: signerSignatureConfig,
      };
      
      if (phone && phone.length >= 10) {
        if (!phone.startsWith('55')) {
          phone = '55' + phone;
        }
        signerData.phone = '+' + phone;
        console.log(`Signer ${signer.name}: phone formatted to ${signerData.phone}, signatureConfig: ${JSON.stringify(signerSignatureConfig)}`);
      } else {
        console.log(`Signer ${signer.name}: no valid phone provided, signatureConfig: ${JSON.stringify(signerSignatureConfig)}`);
      }
      
      return signerData;
    });

    // Criar envelope na BRy com TODOS os documentos
    const envelopePayload = {
      name: title,
      clientName: 'Eon Sign',
      signersData: signersData,
      typeMessaging: ['LINK'],
      documents: documentsToProcess.map(doc => ({
        base64Document: doc.base64,
      })),
    };

    console.log('Sending request to BRy API:', `${apiBaseUrl}/api/service/sign/v1/signatures`);
    console.log('Envelope payload (without base64):', JSON.stringify({
      ...envelopePayload,
      documents: envelopePayload.documents.map(() => ({ base64Document: '[BASE64_CONTENT_HIDDEN]' }))
    }));

    const envelopeResponse = await fetch(`${apiBaseUrl}/api/service/sign/v1/signatures`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(envelopePayload),
    });

    if (!envelopeResponse.ok) {
      const errorText = await envelopeResponse.text();
      console.error('BRy envelope creation failed:', envelopeResponse.status, errorText);
      throw new Error(`Failed to create BRy envelope: ${envelopeResponse.status} - ${errorText}`);
    }

    const envelopeData = await envelopeResponse.json();
    console.log('BRy envelope created successfully');
    console.log('BRy response:', JSON.stringify(envelopeData));

    // Extrair informações do envelope
    const envelopeUuid = envelopeData.uuid;
    
    // Extrair UUIDs de cada documento
    const documentUuids: { documentId: string; bryDocumentUuid: string }[] = [];
    if (envelopeData.documents && envelopeData.documents.length > 0) {
      for (let i = 0; i < envelopeData.documents.length; i++) {
        const bryDoc = envelopeData.documents[i];
        const localDoc = documentsToProcess[i];
        const docUuid = bryDoc.documentUuid || bryDoc.uuid;
        
        documentUuids.push({
          documentId: localDoc.documentId,
          bryDocumentUuid: docUuid,
        });
        console.log(`Document ${localDoc.documentId} -> BRy UUID: ${docUuid}`);
      }
    }
    
    console.log('Envelope UUID:', envelopeUuid);
    console.log('Document UUIDs:', JSON.stringify(documentUuids));
    
    // Extrair links de assinatura por signatário
    const signerLinks: { email: string; nonce: string; link: string }[] = [];
    
    if (envelopeData.signers) {
      console.log('Processing signers from BRy response:', envelopeData.signers.length);
      
      for (const brySign of envelopeData.signers) {
        const signerEmail = brySign.email;
        const signerLink = brySign.link?.href || '';
        
        let signerNonce = brySign.nonce || '';
        if (!signerNonce && signerLink) {
          const linkParts = signerLink.split('/');
          const signIndex = linkParts.indexOf('sign');
          if (signIndex !== -1 && linkParts[signIndex + 1]) {
            signerNonce = linkParts[signIndex + 1];
          } else {
            signerNonce = linkParts[linkParts.length - 1] || '';
          }
        }
        
        console.log(`Signer ${signerEmail}: nonce=${signerNonce}, link=${signerLink}`);
        
        signerLinks.push({
          email: signerEmail,
          nonce: signerNonce,
          link: signerLink || `${apiBaseUrl}/sign/${signerNonce}`,
        });
      }
    }

    console.log('Signer links extracted:', signerLinks.length);

    // Atualizar banco de dados com informações da BRy
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Atualizar TODOS os documentos com o MESMO envelope UUID
    for (const docInfo of documentUuids) {
      const { error: docError } = await supabase
        .from('documents')
        .update({
          bry_envelope_uuid: envelopeUuid,
          bry_document_uuid: docInfo.bryDocumentUuid,
        })
        .eq('id', docInfo.documentId);

      if (docError) {
        console.error(`Error updating document ${docInfo.documentId} with BRy UUIDs:`, docError);
      } else {
        console.log(`Document ${docInfo.documentId} updated with envelope UUID: ${envelopeUuid}`);
      }

      // Atualizar signatários de CADA documento com links da BRy
      for (const signerLink of signerLinks) {
        const { error: signerError } = await supabase
          .from('document_signers')
          .update({
            bry_signer_nonce: signerLink.nonce,
            bry_signer_link: signerLink.link,
          })
          .eq('document_id', docInfo.documentId)
          .eq('email', signerLink.email);

        if (signerError) {
          console.error(`Error updating signer ${signerLink.email} for doc ${docInfo.documentId}:`, signerError);
        }
      }
    }

    console.log('Database updated with BRy information for all documents');

    return new Response(JSON.stringify({
      success: true,
      envelopeUuid,
      documentUuids,
      signerLinks,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in bry-create-envelope:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

serve(handler);
