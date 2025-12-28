import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

const EXPECTED_API_KEY = 'wh-eonsign-1a34-994d-eb07-46c9';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate API key
    const apiKey = req.headers.get('x-api-key');
    if (apiKey !== EXPECTED_API_KEY) {
      console.error('Invalid API key');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    console.log('Received ticket response:', JSON.stringify(payload));

    const { event, ticket, message } = payload;

    // Validate required fields
    if (!ticket?.external_id || !message?.content) {
      return new Response(
        JSON.stringify({ error: 'ticket.external_id and message.content are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find the ticket by ticket_number (external_id)
    const { data: ticketData, error: ticketError } = await supabase
      .from('support_tickets')
      .select('id, user_id, status')
      .eq('ticket_number', ticket.external_id)
      .single();

    if (ticketError || !ticketData) {
      console.error('Ticket not found:', ticket.external_id, ticketError);
      return new Response(
        JSON.stringify({ error: 'Ticket not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ticket: ${ticketData.id}, user: ${ticketData.user_id}`);

    // Insert the admin response message
    const { data: insertedMessage, error: insertError } = await supabase
      .from('ticket_messages')
      .insert({
        ticket_id: ticketData.id,
        user_id: ticketData.user_id, // Using ticket owner's user_id for admin messages
        message: message.content,
        is_admin: true
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting admin message:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to save message' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Admin message inserted:', insertedMessage.id);

    // Update ticket status to 'em_andamento' if it was 'aberto'
    if (ticketData.status === 'aberto') {
      const { error: updateError } = await supabase
        .from('support_tickets')
        .update({ 
          status: 'em_andamento',
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketData.id);

      if (updateError) {
        console.error('Error updating ticket status:', updateError);
      } else {
        console.log('Ticket status updated to em_andamento');
      }
    } else {
      // Just update the updated_at timestamp
      await supabase
        .from('support_tickets')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', ticketData.id);
    }

    // Handle status update events if provided
    if (event === 'ticket.status.updated' && payload.status) {
      const statusMap: Record<string, string> = {
        'open': 'aberto',
        'in_progress': 'em_andamento',
        'resolved': 'resolvido',
        'closed': 'fechado'
      };

      const newStatus = statusMap[payload.status] || payload.status;
      
      const { error: statusError } = await supabase
        .from('support_tickets')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketData.id);

      if (statusError) {
        console.error('Error updating ticket status:', statusError);
      } else {
        console.log(`Ticket status updated to ${newStatus}`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message_id: insertedMessage.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing ticket response:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
