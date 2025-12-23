import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Get BRy access token
async function getToken(): Promise<string> {
  const clientId = Deno.env.get('BRY_CLIENT_ID');
  const clientSecret = Deno.env.get('BRY_CLIENT_SECRET');
  const authUrl = Deno.env.get('BRY_AUTH_URL');

  if (!clientId || !clientSecret || !authUrl) {
    throw new Error('Missing BRy credentials');
  }

  const response = await fetch(authUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to get BRy token: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

// Check envelope status from BRy
async function getEnvelopeStatus(envelopeUuid: string, accessToken: string): Promise<any> {
  const bryApiUrl = Deno.env.get('BRY_API_URL');
  
  const response = await fetch(`${bryApiUrl}/envelopes/${envelopeUuid}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    console.error(`[Cron] Failed to get envelope ${envelopeUuid}: ${response.status}`);
    return null;
  }

  return response.json();
}

const handler = async (req: Request): Promise<Response> => {
  console.log('[BRy Cron] Starting scheduled sync...');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find ALL pending documents with BRy envelope (across all users)
    const { data: pendingDocs, error: fetchError } = await supabase
      .from('documents')
      .select('id, bry_envelope_uuid, name, user_id')
      .not('bry_envelope_uuid', 'is', null)
      .neq('status', 'signed')
      .order('created_at', { ascending: false })
      .limit(50); // Process max 50 per run

    if (fetchError) {
      console.error('[BRy Cron] Error fetching documents:', fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!pendingDocs || pendingDocs.length === 0) {
      console.log('[BRy Cron] No pending BRy documents found');
      return new Response(JSON.stringify({ message: 'No pending documents', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[BRy Cron] Found ${pendingDocs.length} pending documents to sync`);

    // Get BRy access token once for all documents
    const accessToken = await getToken();
    
    const results: any[] = [];
    let updatedCount = 0;

    for (const doc of pendingDocs) {
      try {
        console.log(`[BRy Cron] Checking document: ${doc.name} (${doc.id})`);
        
        // Get envelope status from BRy
        const envelopeData = await getEnvelopeStatus(doc.bry_envelope_uuid, accessToken);
        
        if (!envelopeData) {
          results.push({ id: doc.id, status: 'error', message: 'Failed to fetch envelope' });
          continue;
        }

        // Get signatories from BRy response
        const brySignatories = envelopeData.signatories || [];
        console.log(`[BRy Cron] Document ${doc.id} has ${brySignatories.length} BRy signatories`);

        // Get local signers for this document
        const { data: localSigners, error: signersError } = await supabase
          .from('document_signers')
          .select('*')
          .eq('document_id', doc.id);

        if (signersError) {
          console.error(`[BRy Cron] Error fetching signers for ${doc.id}:`, signersError);
          results.push({ id: doc.id, status: 'error', message: signersError.message });
          continue;
        }

        let hasChanges = false;

        // Check each BRy signatory
        for (const brySigner of brySignatories) {
          if (brySigner.status !== 'SIGNED') continue;

          // Find matching local signer (by nonce or email)
          const localSigner = localSigners?.find(ls => {
            // First try nonce match
            if (ls.bry_signer_nonce && brySigner.nonce) {
              return ls.bry_signer_nonce === brySigner.nonce;
            }
            // Fallback to case-insensitive email
            return ls.email?.toLowerCase() === brySigner.email?.toLowerCase();
          });

          if (localSigner && localSigner.status !== 'signed') {
            console.log(`[BRy Cron] Updating signer ${localSigner.email} to signed`);
            
            const { error: updateError } = await supabase
              .from('document_signers')
              .update({
                status: 'signed',
                signed_at: brySigner.signedAt || new Date().toISOString(),
              })
              .eq('id', localSigner.id);

            if (!updateError) {
              hasChanges = true;
            }
          }
        }

        // Check if all signers have signed
        if (hasChanges) {
          const { data: updatedSigners } = await supabase
            .from('document_signers')
            .select('status')
            .eq('document_id', doc.id);

          const allSigned = updatedSigners?.every(s => s.status === 'signed');
          const signedCount = updatedSigners?.filter(s => s.status === 'signed').length || 0;

          // Update document
          const { error: docUpdateError } = await supabase
            .from('documents')
            .update({
              signed_by: signedCount,
              status: allSigned ? 'signed' : 'pending',
            })
            .eq('id', doc.id);

          if (!docUpdateError) {
            updatedCount++;
            console.log(`[BRy Cron] Document ${doc.id} updated: ${signedCount} signatures, allSigned: ${allSigned}`);
          }

          results.push({ 
            id: doc.id, 
            name: doc.name,
            status: 'updated', 
            signedCount,
            allSigned 
          });
        } else {
          results.push({ id: doc.id, status: 'no_changes' });
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (docError) {
        console.error(`[BRy Cron] Error processing document ${doc.id}:`, docError);
        results.push({ id: doc.id, status: 'error', message: String(docError) });
      }
    }

    console.log(`[BRy Cron] Completed. Processed: ${pendingDocs.length}, Updated: ${updatedCount}`);

    return new Response(JSON.stringify({
      message: 'Cron sync completed',
      processed: pendingDocs.length,
      updated: updatedCount,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[BRy Cron] Fatal error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

serve(handler);
