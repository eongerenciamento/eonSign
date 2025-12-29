import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WEBHOOK_URL = 'https://hook.eonhub.com.br/webhook/eonsign-ticket';

interface TicketEventPayload {
  ticketId: string;
  eventType: 'closed' | 'reopened' | 'rating';
  eventData?: {
    rating?: number;
    comment?: string | null;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('EONSIGN_WEBHOOK_API_KEY');
    if (!apiKey) {
      console.error('EONSIGN_WEBHOOK_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Webhook API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { ticketId, eventType, eventData } = await req.json() as TicketEventPayload;

    console.log(`Processing ticket event: ${eventType} for ticket ${ticketId}`);

    // Fetch ticket info
    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      console.error('Ticket not found:', ticketError);
      return new Response(
        JSON.stringify({ error: 'Ticket not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch user info from profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, nome_completo, organizacao')
      .eq('id', ticket.user_id)
      .single();

    // Fetch company settings for organization name
    const { data: companySettings } = await supabase
      .from('company_settings')
      .select('company_name')
      .eq('user_id', ticket.user_id)
      .single();

    const organizationName = companySettings?.company_name || profile?.organizacao || 'Não informado';
    const customerEmail = profile?.email || 'email@desconhecido.com';

    // Build webhook payload based on event type
    let webhookPayload: Record<string, unknown>;

    switch (eventType) {
      case 'closed':
        webhookPayload = {
          event: 'ticket.closed',
          system_name: 'eonsign',
          organization_name: organizationName,
          customer_email: customerEmail,
          ticket: {
            external_id: ticket.ticket_number
          }
        };
        break;

      case 'rating':
        webhookPayload = {
          event: 'ticket.rating',
          system_name: 'eonsign',
          organization_name: organizationName,
          customer_email: customerEmail,
          ticket: {
            external_id: ticket.ticket_number
          },
          rating: {
            score: eventData?.rating || 0,
            comment: eventData?.comment || null
          }
        };
        break;

      case 'reopened':
        webhookPayload = {
          event: 'ticket.reopened',
          system_name: 'eonsign',
          organization_name: organizationName,
          customer_email: customerEmail,
          ticket: {
            external_id: ticket.ticket_number
          }
        };
        break;

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid event type' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    console.log('Sending webhook payload:', JSON.stringify(webhookPayload));

    // Send webhook to EonHub
    const webhookResponse = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify(webhookPayload),
    });

    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text();
      console.error('Webhook failed:', webhookResponse.status, errorText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Webhook failed with status ${webhookResponse.status}`,
          details: errorText
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Webhook sent successfully for event: ${eventType}`);

    return new Response(
      JSON.stringify({ success: true, event: eventType }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-ticket-event:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
