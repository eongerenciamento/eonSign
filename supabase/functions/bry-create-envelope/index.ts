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

interface CreateEnvelopeRequest {
  documentId: string;
  title: string;
  signers: Signer[];
  documentBase64: string;
  userId: string;
}

async function getToken(): Promise<string> {
  const clientId = Deno.env.get('BRY_CLIENT_ID');
  const clientSecret = Deno.env.get('BRY_CLIENT_SECRET');
  const environment = Deno.env.get('BRY_ENVIRONMENT') || 'homologation';
  
  const baseUrl = environment === 'production' 
    ? 'https://cloud.bry.com.br'
    : 'https://cloud-hom.bry.com.br';

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
    const { documentId, title, signers, documentBase64, userId }: CreateEnvelopeRequest = await req.json();

    console.log('Creating BRy envelope for document:', documentId);
    console.log('Title:', title);
    console.log('Number of signers:', signers.length);

    // Obter token da BRy
    const accessToken = await getToken();
    console.log('BRy token obtained');

    const environment = Deno.env.get('BRY_ENVIRONMENT') || 'homologation';
    const apiBaseUrl = environment === 'production'
      ? 'https://easysign.bry.com.br'
      : 'https://easysign.hom.bry.com.br';

    // Preparar dados dos signatários para a BRy
    const signersData = signers.map(signer => ({
      name: signer.name,
      email: signer.email,
      phone: signer.phone.replace(/\D/g, ''), // Remover formatação
      authenticationOptions: ['GEOLOCATION', 'IP', 'OTP_EMAIL'],
    }));

    // Criar envelope na BRy
    const envelopePayload = {
      name: title,
      clientName: 'Eon Sign',
      signersData: signersData,
      signatureConfig: {
        mode: 'SIMPLE', // Assinatura eletrônica avançada
      },
      typeMessaging: ['LINK'], // Eon Sign envia próprias notificações
      documents: [{
        base64Document: documentBase64,
        name: `${title}.pdf`,
      }],
    };

    console.log('Sending request to BRy API:', `${apiBaseUrl}/api/service/sign/v1/signatures`);

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
    console.log('BRy envelope created:', JSON.stringify(envelopeData));

    // Extrair informações do envelope
    const envelopeUuid = envelopeData.uuid;
    const documentUuid = envelopeData.documents?.[0]?.uuid;
    
    // Extrair links de assinatura por signatário
    const signerLinks: { email: string; nonce: string; link: string }[] = [];
    
    if (envelopeData.signers) {
      for (const brySign of envelopeData.signers) {
        const signerEmail = brySign.email;
        const signerNonce = brySign.nonce;
        const signerLink = `${apiBaseUrl}/sign/${signerNonce}`;
        
        signerLinks.push({
          email: signerEmail,
          nonce: signerNonce,
          link: signerLink,
        });
      }
    }

    console.log('Signer links extracted:', signerLinks.length);

    // Atualizar banco de dados com informações da BRy
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Atualizar documento com UUIDs da BRy
    const { error: docError } = await supabase
      .from('documents')
      .update({
        bry_envelope_uuid: envelopeUuid,
        bry_document_uuid: documentUuid,
      })
      .eq('id', documentId);

    if (docError) {
      console.error('Error updating document with BRy UUIDs:', docError);
    }

    // Atualizar signatários com links da BRy
    for (const signerLink of signerLinks) {
      const { error: signerError } = await supabase
        .from('document_signers')
        .update({
          bry_signer_nonce: signerLink.nonce,
          bry_signer_link: signerLink.link,
        })
        .eq('document_id', documentId)
        .eq('email', signerLink.email);

      if (signerError) {
        console.error('Error updating signer with BRy link:', signerError);
      }
    }

    console.log('Database updated with BRy information');

    return new Response(JSON.stringify({
      success: true,
      envelopeUuid,
      documentUuid,
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
