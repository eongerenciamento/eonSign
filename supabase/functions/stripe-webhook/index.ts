import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

// Helper function to safely convert Stripe timestamps to ISO strings
const safeTimestampToISO = (timestamp: number | undefined | null): string | null => {
  if (timestamp === undefined || timestamp === null || typeof timestamp !== 'number') {
    logStep("Invalid timestamp received", { timestamp, type: typeof timestamp });
    return null;
  }
  try {
    const date = new Date(timestamp * 1000);
    if (isNaN(date.getTime())) {
      logStep("Invalid date from timestamp", { timestamp });
      return null;
    }
    return date.toISOString();
  } catch (error) {
    logStep("Error converting timestamp", { timestamp, error: String(error) });
    return null;
  }
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
    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    
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
          const email = session.metadata?.email;
          const organizationName = session.metadata?.organization_name;
          const userId = session.metadata?.user_id;
          const tierName = session.metadata?.tier_name;
          const documentLimit = parseInt(session.metadata?.document_limit || "5");
          
          logStep("Processing checkout.session.completed", { email, organizationName, userId, tierName, documentLimit, mode: session.mode });

          // For subscription mode, create/update subscription record
          if (session.mode === "subscription" && session.subscription) {
            const subscriptionId = session.subscription as string;
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            
            logStep("Subscription retrieved", { 
              id: subscription.id, 
              status: subscription.status,
              current_period_start: subscription.current_period_start,
              current_period_end: subscription.current_period_end
            });

            // Convert timestamps safely with fallback to current time + 1 month
            const now = new Date();
            const oneMonthFromNow = new Date(now);
            oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
            
            const periodStart = safeTimestampToISO(subscription.current_period_start) || now.toISOString();
            const periodEnd = safeTimestampToISO(subscription.current_period_end) || oneMonthFromNow.toISOString();

            logStep("Period dates calculated", { periodStart, periodEnd });

            // If this is a new account (has email in metadata), create the user
            if (email && organizationName && !userId) {
              logStep("Creating new user account", { email, organizationName });
              
              // Generate temporary password (first part of email before @)
              const tempPassword = email.split('@')[0] + Math.random().toString(36).slice(-4);
              
              // Create user via Admin API
              const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
                email,
                password: tempPassword,
                email_confirm: true,
              });

              if (createError) {
                logStep("Error creating user", { error: createError.message });
                throw createError;
              }

              logStep("User created", { userId: newUser.user.id });

              // Create company_settings
              await supabaseClient.from("company_settings").insert({
                user_id: newUser.user.id,
                company_name: organizationName,
                cnpj: "00.000.000/0000-00", // Placeholder
                admin_name: organizationName,
                admin_cpf: "000.000.000-00", // Placeholder
                admin_phone: "(00)00000-0000", // Placeholder
                admin_email: email,
              });

              logStep("Company settings created");

              // Create subscription
              const { error: subError } = await supabaseClient.from("user_subscriptions").insert({
                user_id: newUser.user.id,
                stripe_customer_id: session.customer as string,
                stripe_subscription_id: subscriptionId,
                stripe_price_id: subscription.items.data[0]?.price?.id || null,
                plan_name: tierName || 'Básico',
                status: subscription.status as any,
                current_period_start: periodStart,
                current_period_end: periodEnd,
                cancel_at_period_end: subscription.cancel_at_period_end || false,
                document_limit: documentLimit,
              });

              if (subError) {
                logStep("Error creating subscription", { error: subError.message });
                throw subError;
              }

              logStep("Subscription created");

              // Send welcome email with temporary password
              await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-welcome-email`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
                },
                body: JSON.stringify({
                  email,
                  name: organizationName,
                  userId: newUser.user.id,
                  tempPassword,
                }),
              });

              logStep("Welcome email sent");
            } else if (userId) {
              // Existing user upgrading - update subscription
              logStep("Updating subscription for existing user", { userId });

              // First check if user has a subscription
              const { data: existingSub } = await supabaseClient
                .from("user_subscriptions")
                .select("id")
                .eq("user_id", userId)
                .single();

              if (existingSub) {
                // Update existing subscription
                const { error: updateError } = await supabaseClient
                  .from("user_subscriptions")
                  .update({
                    stripe_customer_id: session.customer as string,
                    stripe_subscription_id: subscriptionId,
                    stripe_price_id: subscription.items.data[0]?.price?.id || null,
                    plan_name: tierName || 'Básico',
                    status: subscription.status as any,
                    current_period_start: periodStart,
                    current_period_end: periodEnd,
                    cancel_at_period_end: subscription.cancel_at_period_end || false,
                    document_limit: documentLimit,
                    updated_at: new Date().toISOString()
                  })
                  .eq("user_id", userId);

                if (updateError) {
                  logStep("Error updating subscription", { error: updateError.message });
                  throw updateError;
                }
              } else {
                // Insert new subscription for existing user
                const { error: insertError } = await supabaseClient
                  .from("user_subscriptions")
                  .insert({
                    user_id: userId,
                    stripe_customer_id: session.customer as string,
                    stripe_subscription_id: subscriptionId,
                    stripe_price_id: subscription.items.data[0]?.price?.id || null,
                    plan_name: tierName || 'Básico',
                    status: subscription.status as any,
                    current_period_start: periodStart,
                    current_period_end: periodEnd,
                    cancel_at_period_end: subscription.cancel_at_period_end || false,
                    document_limit: documentLimit,
                  });

                if (insertError) {
                  logStep("Error inserting subscription", { error: insertError.message });
                  throw insertError;
                }
              }

              logStep("Subscription updated for existing user");
            }
          }
          break;
        }

        case "customer.subscription.updated": {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;

          logStep("Processing customer.subscription.updated", { subscriptionId: subscription.id });

          // Convert timestamps safely
          const periodStart = safeTimestampToISO(subscription.current_period_start);
          const periodEnd = safeTimestampToISO(subscription.current_period_end);

          // Find user by customer_id
          const { data: existingSub } = await supabaseClient
            .from("user_subscriptions")
            .select("user_id")
            .eq("stripe_customer_id", customerId)
            .single();

          if (existingSub) {
            const updateData: any = {
              status: subscription.status,
              cancel_at_period_end: subscription.cancel_at_period_end || false,
              updated_at: new Date().toISOString()
            };

            // Only update period dates if they're valid
            if (periodStart) updateData.current_period_start = periodStart;
            if (periodEnd) updateData.current_period_end = periodEnd;

            await supabaseClient
              .from("user_subscriptions")
              .update(updateData)
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
