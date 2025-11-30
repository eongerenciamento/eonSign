import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  try {
    logStep("Webhook received");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const signature = req.headers.get("stripe-signature");
    
    if (!signature) throw new Error("No stripe-signature header");

    const body = await req.text();
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    
    logStep("Event verified", { type: event.type, id: event.id });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Log event
    await supabaseClient.from("stripe_webhook_events").insert({
      stripe_event_id: event.id,
      event_type: event.type,
      payload: event.data.object,
      processed: false
    });

    // Process event
    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          const userId = session.metadata?.user_id;
          const tierName = session.metadata?.tier_name;
          const documentLimit = parseInt(session.metadata?.document_limit || "5");
          
          if (!userId || !tierName) throw new Error("Missing metadata in session");

          logStep("Processing checkout.session.completed (tier upgrade)", { userId, tierName, documentLimit });

          // For one-time payment mode, upgrade the user's tier
          if (session.mode === "payment" && session.payment_status === "paid") {
            await supabaseClient.from("user_subscriptions").upsert({
              user_id: userId,
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: null,
              stripe_price_id: session.metadata?.price_id || null,
              plan_name: tierName,
              status: 'active',
              current_period_start: null,
              current_period_end: null,
              cancel_at_period_end: false,
              document_limit: documentLimit,
              updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });

            logStep("Tier upgraded successfully");
          }
          break;
        }

        case "customer.subscription.updated": {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;

          logStep("Processing customer.subscription.updated", { subscriptionId: subscription.id });

          // Find user by customer_id
          const { data: existingSub } = await supabaseClient
            .from("user_subscriptions")
            .select("user_id")
            .eq("stripe_customer_id", customerId)
            .single();

          if (existingSub) {
            await supabaseClient
              .from("user_subscriptions")
              .update({
                status: subscription.status,
                current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
                cancel_at_period_end: subscription.cancel_at_period_end,
                updated_at: new Date().toISOString()
              })
              .eq("stripe_subscription_id", subscription.id);

            logStep("Subscription updated");
          }
          break;
        }

        case "customer.subscription.deleted": {
          const subscription = event.data.object as Stripe.Subscription;
          
          logStep("Processing customer.subscription.deleted", { subscriptionId: subscription.id });

          await supabaseClient
            .from("user_subscriptions")
            .update({
              status: 'canceled',
              updated_at: new Date().toISOString()
            })
            .eq("stripe_subscription_id", subscription.id);

          logStep("Subscription canceled");
          break;
        }

        case "invoice.payment_succeeded": {
          const invoice = event.data.object as Stripe.Invoice;
          const subscriptionId = invoice.subscription as string;

          if (subscriptionId) {
            logStep("Processing invoice.payment_succeeded", { subscriptionId });

            await supabaseClient
              .from("user_subscriptions")
              .update({
                status: 'active',
                updated_at: new Date().toISOString()
              })
              .eq("stripe_subscription_id", subscriptionId);
          }
          break;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object as Stripe.Invoice;
          const subscriptionId = invoice.subscription as string;

          if (subscriptionId) {
            logStep("Processing invoice.payment_failed", { subscriptionId });

            await supabaseClient
              .from("user_subscriptions")
              .update({
                status: 'past_due',
                updated_at: new Date().toISOString()
              })
              .eq("stripe_subscription_id", subscriptionId);
          }
          break;
        }

        default:
          logStep("Unhandled event type", { type: event.type });
      }

      // Mark event as processed
      await supabaseClient
        .from("stripe_webhook_events")
        .update({
          processed: true,
          processed_at: new Date().toISOString()
        })
        .eq("stripe_event_id", event.id);

    } catch (processingError) {
      const errorMsg = processingError instanceof Error ? processingError.message : String(processingError);
      logStep("Processing error", { error: errorMsg });

      // Log error
      await supabaseClient
        .from("stripe_webhook_events")
        .update({
          processed: true,
          processed_at: new Date().toISOString(),
          error_message: errorMsg
        })
        .eq("stripe_event_id", event.id);

      throw processingError;
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    });
  }
});
