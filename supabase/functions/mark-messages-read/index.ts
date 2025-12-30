import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WEBHOOK_URL = 'https://eonhub.com.br/api/v1/tickets/webhook';
const WEBHOOK_API_KEY = 'wh-eonsign-1a34-994d-eb07-46c9';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header');
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the JWT token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { ticketId, messageIds } = await req.json();

    if (!ticketId || !messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'ticketId and messageIds array are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Marking ${messageIds.length} messages as read for ticket ${ticketId}`);

    // Verify the ticket belongs to the user
    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .select('id, ticket_number, user_id')
      .eq('id', ticketId)
      .eq('user_id', user.id)
      .single();

    if (ticketError || !ticket) {
      console.error('Ticket not found or access denied:', ticketError);
      return new Response(
        JSON.stringify({ error: 'Ticket not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const readAt = new Date().toISOString();

    // Update messages read_at timestamp
    const { data: updatedMessages, error: updateError } = await supabase
      .from('ticket_messages')
      .update({ read_at: readAt })
      .eq('ticket_id', ticketId)
      .in('id', messageIds)
      .eq('is_admin', true) // Only mark admin messages as read by user
      .is('read_at', null) // Only update unread messages
      .select('id');

    if (updateError) {
      console.error('Error updating messages:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update messages' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const updatedCount = updatedMessages?.length || 0;
    console.log(`Updated ${updatedCount} messages as read`);

    // Send webhook to external system if messages were updated
    if (updatedCount > 0) {
      const webhookPayload = {
        event: 'ticket.messages.read',
        system_name: 'eonsign',
        ticket: {
          external_id: ticket.ticket_number
        },
        messages: {
          read_at: readAt,
          message_ids: updatedMessages?.map(m => m.id) || []
        }
      };

      console.log('Sending read receipt webhook:', JSON.stringify(webhookPayload));

      try {
        const webhookResponse = await fetch(WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': WEBHOOK_API_KEY
          },
          body: JSON.stringify(webhookPayload)
        });

        if (!webhookResponse.ok) {
          console.error('Webhook failed:', webhookResponse.status, await webhookResponse.text());
        } else {
          console.log('Webhook sent successfully');
        }
      } catch (webhookError) {
        console.error('Webhook error:', webhookError);
        // Don't fail the request if webhook fails
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        read_at: readAt,
        updated_count: updatedCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error marking messages as read:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
