import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WEBHOOK_URL = 'https://beyefodsuuftviwthdfe.supabase.co/functions/v1/ticket-webhook';
const WEBHOOK_API_KEY = 'wh-eonsign-1a34-994d-eb07-46c9';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's token
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get user
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Creating ticket for user: ${user.id}`);

    // Parse request body
    const { title, category, priority, description, attachmentPaths } = await req.json();

    if (!title || !description) {
      return new Response(
        JSON.stringify({ error: 'Title and description are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create service role client for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Generate ticket number in format: 03.YY.NNNN
    const currentYear = new Date().getFullYear().toString().slice(-2); // "25"
    const prefix = `03.${currentYear}.`;

    // Find the last ticket number for this year
    const { data: lastTicket } = await supabaseAdmin
      .from('support_tickets')
      .select('ticket_number')
      .like('ticket_number', `${prefix}%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let sequentialNumber = 1;
    if (lastTicket?.ticket_number) {
      // Extract the sequential number (last 4 digits after the prefix)
      const parts = lastTicket.ticket_number.split('.');
      if (parts.length === 3) {
        const lastSequential = parseInt(parts[2], 10);
        if (!isNaN(lastSequential)) {
          sequentialNumber = lastSequential + 1;
        }
      }
    }

    const ticketNumber = `${prefix}${sequentialNumber.toString().padStart(4, '0')}`;
    console.log(`Generated ticket number: ${ticketNumber}`);

    // Create full description
    const fullDescription = `Categoria: ${category || 'N/A'}\nPrioridade: ${priority || 'N/A'}\n\n${description}${
      attachmentPaths && attachmentPaths.length > 0 ? `\n\nAnexos: ${attachmentPaths.length}` : ""
    }`;

    // Insert ticket
    const { data: ticket, error: insertError } = await supabaseAdmin
      .from('support_tickets')
      .insert({
        user_id: user.id,
        title,
        description: fullDescription,
        ticket_number: ticketNumber,
        status: 'aberto',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting ticket:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create ticket' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Ticket created: ${ticketNumber}`);

    // Get user profile for webhook
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('nome_completo, email')
      .eq('id', user.id)
      .single();

    // Get company settings for organization name
    const { data: companySettings } = await supabaseAdmin
      .from('company_settings')
      .select('company_name')
      .eq('user_id', user.id)
      .single();

    const userName = profile?.nome_completo || user.email?.split('@')[0] || 'Usuário';
    const userEmail = profile?.email || user.email || '';
    const organizationName = companySettings?.company_name || 'eonSign';

    // Send webhook to external system
    const webhookPayload = {
      event: 'ticket.created',
      system_name: 'eonsign',
      organization_name: organizationName,
      customer_email: userEmail,
      ticket: {
        external_id: ticketNumber,
        title,
        category: category || 'N/A',
        priority: priority || 'N/A',
        description,
      },
      user: {
        name: userName,
        email: userEmail,
        customer_email: userEmail,
      },
    };

    console.log('Sending webhook:', JSON.stringify(webhookPayload));

    try {
      const webhookResponse = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': WEBHOOK_API_KEY,
        },
        body: JSON.stringify(webhookPayload),
      });

      const webhookStatus = webhookResponse.status;
      const webhookBody = await webhookResponse.text();
      console.log(`Webhook response: ${webhookStatus} - ${webhookBody}`);

      if (!webhookResponse.ok) {
        console.error(`Webhook failed with status ${webhookStatus}: ${webhookBody}`);
      }
    } catch (webhookError) {
      console.error('Webhook error:', webhookError);
      // Don't fail the request if webhook fails, ticket was already created
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        ticket: {
          id: ticket.id,
          ticket_number: ticketNumber,
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
