import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Sanitiza nome de arquivo para evitar erro de ByteString em headers HTTP
function sanitizeFilename(filename: string): string {
  return filename
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-zA-Z0-9._-]/g, '_'); // Substitui caracteres especiais por _
}

async function getToken(): Promise<string> {
  const clientId = Deno.env.get('BRY_CLIENT_ID');
  const clientSecret = Deno.env.get('BRY_CLIENT_SECRET');
  const environment = Deno.env.get('BRY_ENVIRONMENT') || 'homologation';

  if (!clientId || !clientSecret) {
    throw new Error('BRy credentials not configured (BRY_CLIENT_ID / BRY_CLIENT_SECRET)');
  }

  const authUrl = 'https://cloud.bry.com.br/token-service/jwt';

  console.log('[BRy Auth] Environment:', environment);
  console.log('[BRy Auth] Requesting token from:', authUrl);

  const basicAuth = btoa(`${clientId}:${clientSecret}`);

  const tokenResponse = await fetch(authUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`,
    },
    body: 'grant_type=client_credentials',
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Failed to get BRy token: ${tokenResponse.status} - ${errorText}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

// Função para baixar o relatório unificado de um documento específico
async function downloadReportUnified(
  document: any,
  accessToken: string,
  apiBaseUrl: string,
  supabase: any
): Promise<ArrayBuffer | null> {
  if (!document.bry_envelope_uuid) {
    console.log(`Document ${document.id} does not have bry_envelope_uuid, skipping`);
    return null;
  }

  // Se não temos o documentUuid/nonce, buscar do envelope
  let documentNonce = document.bry_document_uuid;

  if (!documentNonce) {
    console.log(`Fetching document nonce from BRy envelope for document ${document.id}...`);
    const envelopeUrl = `${apiBaseUrl}/api/service/sign/v1/signatures/${document.bry_envelope_uuid}`;

    const envelopeResponse = await fetch(envelopeUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (envelopeResponse.ok) {
      const envelopeData = await envelopeResponse.json();
      console.log(`Envelope data for ${document.id}:`, JSON.stringify(envelopeData));

      const documentsList = envelopeData.documents || [];
      
      // Tentar encontrar o documento correto pelo nome ou pela ordem
      const docIndex = documentsList.findIndex((d: any) => 
        d.name === document.name || d.originalName === document.name
      );
      
      if (docIndex >= 0) {
        documentNonce = documentsList[docIndex].nonce || documentsList[docIndex].documentUuid || documentsList[docIndex].uuid;
      } else if (documentsList.length > 0) {
        // Se não encontrou por nome, usar o primeiro (para documentos únicos)
        documentNonce = documentsList[0].nonce || documentsList[0].documentUuid || documentsList[0].uuid;
      }

      // Salvar para uso futuro
      if (documentNonce) {
        await supabase
          .from('documents')
          .update({ bry_document_uuid: documentNonce })
          .eq('id', document.id);
        console.log(`Saved document nonce for ${document.id}: ${documentNonce}`);
      }
    }
  }

  if (!documentNonce) {
    console.error(`Could not determine document nonce for document ${document.id}`);
    return null;
  }

  // Baixar relatório unificado
  const reportUrl = `${apiBaseUrl}/api/service/sign/v1/signatures/${document.bry_envelope_uuid}/documents/${documentNonce}/reportUnified`;
  console.log(`Downloading report from: ${reportUrl}`);

  const reportResponse = await fetch(reportUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!reportResponse.ok) {
    const errorText = await reportResponse.text();
    console.error(`Failed to download report for document ${document.id}:`, reportResponse.status, errorText);
    return null;
  }

  const pdfBuffer = await reportResponse.arrayBuffer();
  console.log(`Report downloaded for document ${document.id}, size: ${pdfBuffer.byteLength} bytes`);

  return pdfBuffer;
}

// Função para fazer merge de múltiplos PDFs
async function mergeMultiplePdfs(pdfBuffers: ArrayBuffer[]): Promise<Uint8Array> {
  if (pdfBuffers.length === 0) {
    throw new Error('No PDFs to merge');
  }

  if (pdfBuffers.length === 1) {
    return new Uint8Array(pdfBuffers[0]);
  }

  console.log(`Merging ${pdfBuffers.length} PDFs...`);

  const mergedPdf = await PDFDocument.create();

  for (let i = 0; i < pdfBuffers.length; i++) {
    try {
      const pdfDoc = await PDFDocument.load(pdfBuffers[i]);
      const pages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
      pages.forEach((page) => mergedPdf.addPage(page));
      console.log(`Added ${pages.length} pages from PDF ${i + 1}`);
    } catch (error) {
      console.error(`Error processing PDF ${i + 1}:`, error);
    }
  }

  const mergedPdfBytes = await mergedPdf.save();
  console.log(`Merged PDF created with ${mergedPdf.getPageCount()} total pages`);

  return mergedPdfBytes;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { documentId } = await req.json();

    if (!documentId) {
      return new Response(JSON.stringify({ error: 'documentId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Downloading BRy report for document: ${documentId}`);

    // Buscar documento
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      return new Response(JSON.stringify({ error: 'Document not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!document.bry_envelope_uuid) {
      return new Response(JSON.stringify({ error: 'Document does not have BRy envelope' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Obter token BRy
    const accessToken = await getToken();
    console.log('BRy token obtained');

    const environment = Deno.env.get('BRY_ENVIRONMENT') || 'homologation';
    const apiBaseUrl = environment === 'production'
      ? 'https://easysign.bry.com.br'
      : 'https://easysign.hom.bry.com.br';

    // Verificar se o documento faz parte de um envelope com múltiplos documentos
    let documentsToProcess = [document];
    let isEnvelope = false;
    let envelopeTitle = document.name;

    // Primeiro, tentar por envelope_id (envelope interno da plataforma)
    if (document.envelope_id) {
      console.log(`Document belongs to envelope_id: ${document.envelope_id}`);
      const { data: envelopeDocuments, error: envelopeError } = await supabase
        .from('documents')
        .select('*')
        .eq('envelope_id', document.envelope_id)
        .order('created_at', { ascending: true });

      if (!envelopeError && envelopeDocuments && envelopeDocuments.length > 1) {
        documentsToProcess = envelopeDocuments;
        isEnvelope = true;
        console.log(`Found ${envelopeDocuments.length} documents in envelope`);

        // Buscar título do envelope
        const { data: envelope } = await supabase
          .from('envelopes')
          .select('title')
          .eq('id', document.envelope_id)
          .single();

        if (envelope?.title) {
          envelopeTitle = envelope.title;
        }
      }
    }

    // Se não encontrou por envelope_id, tentar por bry_envelope_uuid
    if (!isEnvelope && document.bry_envelope_uuid) {
      console.log(`Checking for documents with same bry_envelope_uuid: ${document.bry_envelope_uuid}`);
      const { data: bryEnvelopeDocuments, error: bryError } = await supabase
        .from('documents')
        .select('*')
        .eq('bry_envelope_uuid', document.bry_envelope_uuid)
        .order('created_at', { ascending: true });

      if (!bryError && bryEnvelopeDocuments && bryEnvelopeDocuments.length > 1) {
        documentsToProcess = bryEnvelopeDocuments;
        isEnvelope = true;
        console.log(`Found ${bryEnvelopeDocuments.length} documents with same bry_envelope_uuid`);
      }
    }

    console.log(`Processing ${documentsToProcess.length} document(s), isEnvelope: ${isEnvelope}`);

    // Baixar reportUnified de cada documento
    const pdfBuffers: ArrayBuffer[] = [];
    
    for (const doc of documentsToProcess) {
      console.log(`Processing document: ${doc.id} - ${doc.name}`);
      
      const reportBuffer = await downloadReportUnified(doc, accessToken, apiBaseUrl, supabase);
      
      if (reportBuffer) {
        pdfBuffers.push(reportBuffer);
      } else {
        console.warn(`Could not download report for document ${doc.id}`);
      }
    }

    if (pdfBuffers.length === 0) {
      return new Response(JSON.stringify({ error: 'Could not download any reports from BRy' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fazer merge se houver múltiplos PDFs
    const finalPdfBytes = await mergeMultiplePdfs(pdfBuffers);
    console.log(`Final PDF size: ${finalPdfBytes.byteLength} bytes`);

    const safeFilename = sanitizeFilename(envelopeTitle);
    console.log(`Original filename: ${envelopeTitle}, sanitized: ${safeFilename}`);

    return new Response(finalPdfBytes.buffer as ArrayBuffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeFilename}_evidencias.pdf"`,
      },
    });

  } catch (error: any) {
    console.error('Error in bry-download-report:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

serve(handler);
