import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Prescription types with their OIDs
const PRESCRIPTION_TYPES: Record<string, { oid: string; label: string }> = {
  'MEDICAMENTO': { oid: '2.16.76.1.12.1.1', label: 'Prescrição de medicamento' },
  'ATESTADO': { oid: '2.16.76.1.12.1.2', label: 'Atestado médico' },
  'SOLICITACAO_EXAME': { oid: '2.16.76.1.12.1.3', label: 'Solicitação de exame' },
  'LAUDO': { oid: '2.16.76.1.12.1.4', label: 'Laudo laboratorial' },
  'SUMARIA_ALTA': { oid: '2.16.76.1.12.1.5', label: 'Sumária de alta' },
  'ATENDIMENTO_CLINICO': { oid: '2.16.76.1.12.1.6', label: 'Registro de atendimento clínico' },
  'DISPENSACAO_MEDICAMENTO': { oid: '2.16.76.1.12.1.7', label: 'Dispensação de medicamento' },
  'VACINACAO': { oid: '2.16.76.1.12.1.8', label: 'Indicação para vacinação' },
  'RELATORIO_MEDICO': { oid: '2.16.76.1.12.1.11', label: 'Relatório médico' },
};

// Map councils to professional types for BRy API
const COUNCIL_TO_PROFESSIONAL_TYPE: Record<string, string> = {
  'CRM': 'MEDICO',
  'CRO': 'MEDICO', // Odontologist uses MEDICO type
  'CRF': 'FARMACEUTICO',
};

// Error messages translation
const ERROR_MESSAGES: Record<string, string> = {
  'excecao.hub.requisicao': 'Não foi possível processar a requisição.',
  'excecao.hub.recurso.inexistente': 'Recurso não encontrado.',
  'excecao.hub.requisicao.param.nulo': 'Parâmetro obrigatório não informado.',
  'excecao.hub.prescricao.profissional': 'Tipo de profissional não informado.',
  'excecao.hub.prescricao.profissional.invalido': 'Tipo de profissional inválido.',
  'excecao.hub.prescricao.uf': 'UF do profissional não informada.',
  'excecao.hub.prescricao.tipo.nula': 'Tipo de prescrição não informado.',
  'excecao.hub.prescricao.tipo.invalida': 'Tipo de prescrição inválido.',
  'excecao.hub.prescricao.especialidade.nula': 'Especialidade do profissional não informada.',
  'excecao.hub.prescricao.registro': 'Número de registro do profissional não informado.',
  'excecao.hub.token.corrompido': 'Token de autenticação inválido.',
  'excecao.hub.token.invalido': 'Token de autenticação expirado.',
};

interface PrescriptionRequest {
  documentBase64: string;
  documentName: string;
  prescriptionType: string;
  professionalCouncil: string;
  registrationNumber: string;
  registrationState: string;
  specialty?: string;
}

async function getToken(): Promise<string> {
  const bryEnvironment = Deno.env.get('BRY_ENVIRONMENT') || 'homologation';
  const clientId = Deno.env.get('BRY_CLIENT_ID');
  const clientSecret = Deno.env.get('BRY_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error('BRy credentials not configured');
  }

  const authUrl = 'https://cloud.bry.com.br/token-service/jwt';

  console.log('[BRY-PRESCRIPTION] Environment:', bryEnvironment);
  console.log('[BRY-PRESCRIPTION] Requesting token from:', authUrl);

  const basicAuth = btoa(`${clientId}:${clientSecret}`);

  const response = await fetch(authUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`,
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[BRY-PRESCRIPTION] Token error:', response.status, errorText);
    throw new Error(`Failed to obtain BRy token: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: PrescriptionRequest = await req.json();
    
    console.log('[BRY-PRESCRIPTION] Processing request:', {
      prescriptionType: body.prescriptionType,
      professionalCouncil: body.professionalCouncil,
      registrationState: body.registrationState,
    });

    // Validate required fields
    if (!body.documentBase64) {
      throw new Error('Documento não informado');
    }
    if (!body.prescriptionType || !PRESCRIPTION_TYPES[body.prescriptionType]) {
      throw new Error('Tipo de prescrição inválido');
    }
    if (!body.professionalCouncil) {
      throw new Error('Conselho de classe não informado');
    }
    if (!body.registrationNumber) {
      throw new Error('Número de registro não informado');
    }
    if (!body.registrationState) {
      throw new Error('UF do registro não informada');
    }

    // Determine professional type
    const professionalType = COUNCIL_TO_PROFESSIONAL_TYPE[body.professionalCouncil];
    if (!professionalType) {
      throw new Error(`Conselho ${body.professionalCouncil} não suportado para prescrição médica`);
    }

    // Get BRy token
    const token = await getToken();

    // Build multipart form data
    const bryEnvironment = Deno.env.get('BRY_ENVIRONMENT') || 'homologation';
    const baseUrl = bryEnvironment === 'production' 
      ? 'https://cloud.bry.com.br' 
      : 'https://cloud-hom.bry.com.br';

    // Convert base64 to blob
    const binaryString = atob(body.documentBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const pdfBlob = new Blob([bytes], { type: 'application/pdf' });

    // Create FormData
    const formData = new FormData();
    formData.append('prescricao[0][documento]', pdfBlob, body.documentName || 'prescricao.pdf');
    formData.append('prescricao[0][tipo]', body.prescriptionType);
    formData.append('profissional', professionalType);
    formData.append('numeroRegistro', body.registrationNumber);
    formData.append('UF', body.registrationState);
    if (body.specialty) {
      formData.append('especialidade', body.specialty);
    }

    console.log('[BRY-PRESCRIPTION] Sending to BRy API:', {
      url: `${baseUrl}/fw/v1/pdf/carimbar`,
      tipo: body.prescriptionType,
      profissional: professionalType,
      numeroRegistro: body.registrationNumber,
      UF: body.registrationState,
      especialidade: body.specialty,
    });

    // Call BRy prescription API
    const bryResponse = await fetch(`${baseUrl}/fw/v1/pdf/carimbar`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!bryResponse.ok) {
      const errorBody = await bryResponse.text();
      console.error('[BRY-PRESCRIPTION] BRy API error:', bryResponse.status, errorBody);
      
      try {
        const errorJson = JSON.parse(errorBody);
        const translatedMessage = ERROR_MESSAGES[errorJson.chave] || errorJson.message || 'Erro ao processar prescrição';
        throw new Error(translatedMessage);
      } catch (parseError) {
        if (parseError instanceof SyntaxError) {
          throw new Error(`Erro na API de prescrição: ${bryResponse.status}`);
        }
        throw parseError;
      }
    }

    // Get the PDF with metadata as ArrayBuffer
    const pdfWithMetadata = await bryResponse.arrayBuffer();
    
    // Convert to base64
    const pdfBase64 = btoa(
      new Uint8Array(pdfWithMetadata).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    console.log('[BRY-PRESCRIPTION] Successfully processed prescription, PDF size:', pdfWithMetadata.byteLength);

    return new Response(
      JSON.stringify({
        success: true,
        pdfBase64: pdfBase64,
        prescriptionType: body.prescriptionType,
        prescriptionTypeLabel: PRESCRIPTION_TYPES[body.prescriptionType].label,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[BRY-PRESCRIPTION] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
