import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

// Mapeamento de Price IDs para limites e nomes de planos (eonSign)
const PRICE_ID_TO_PLAN: Record<string, { limit: number; name: string }> = {
  // Mensais
  "price_1SnWXYHRTD5WvpxjKl4TP1T8": { limit: 25, name: "Start" },
  "price_1SnWXtHRTD5Wvpxjtgr5tWKJ": { limit: 50, name: "Pro" },
  "price_1SnWY9HRTD5Wvpxjyw5KH0cX": { limit: 100, name: "Empresarial I" },
  "price_1SnWYPHRTD5WvpxjyWw62Qe0": { limit: 200, name: "Empresarial II" },
  "price_1SnWYfHRTD5Wvpxjo3b98A4o": { limit: -1, name: "Ultra" }, // -1 = ilimitado
  // Anuais
  "price_1SnWZ7HRTD5WvpxjuboSevS5": { limit: 25, name: "Start" },
  "price_1SnWZOHRTD5Wvpxj8wRU9vHE": { limit: 50, name: "Pro" },
  "price_1SnWZiHRTD5WvpxjVWZnxv0e": { limit: 100, name: "Empresarial I" },
  "price_1SnWa4HRTD5WvpxjLSyivW7p": { limit: 200, name: "Empresarial II" },
  "price_1SnWaTHRTD5WvpxjoAUEkP0P": { limit: -1, name: "Ultra" }, // -1 = ilimitado
};

// Helper para obter limite e nome do plano pelo price_id
const getPlanFromPriceId = (priceId: string | null | undefined): { limit: number; name: string } => {
  if (!priceId) return { limit: 5, name: "Gratuito" };
  return PRICE_ID_TO_PLAN[priceId] || { limit: 5, name: "Básico" };
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
          const productType = session.metadata?.product_type;
          const email = session.metadata?.email;
          const organizationName = session.metadata?.organization_name;
          const userId = session.metadata?.user_id;
          const tierName = session.metadata?.tier_name;
          const documentLimit = parseInt(session.metadata?.document_limit || "5");
          
          logStep("Processing checkout.session.completed", { email, organizationName, userId, tierName, documentLimit, mode: session.mode, productType });


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

            // Convert timestamps safely with fallback based on subscription interval
            const now = new Date();
            const interval = subscription.items.data[0]?.price?.recurring?.interval || 'month';
            const intervalCount = subscription.items.data[0]?.price?.recurring?.interval_count || 1;
            
            const fallbackPeriodEnd = new Date(now);
            if (interval === 'year') {
              fallbackPeriodEnd.setFullYear(fallbackPeriodEnd.getFullYear() + intervalCount);
            } else if (interval === 'month') {
              fallbackPeriodEnd.setMonth(fallbackPeriodEnd.getMonth() + intervalCount);
            } else if (interval === 'week') {
              fallbackPeriodEnd.setDate(fallbackPeriodEnd.getDate() + (7 * intervalCount));
            } else if (interval === 'day') {
              fallbackPeriodEnd.setDate(fallbackPeriodEnd.getDate() + intervalCount);
            }
            
            const periodStart = safeTimestampToISO(subscription.current_period_start) || now.toISOString();
            const periodEnd = safeTimestampToISO(subscription.current_period_end) || fallbackPeriodEnd.toISOString();

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
                  organizationName,
                  tierName,
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

        case "customer.subscription.created": {
          const subscription = event.data.object as Stripe.Subscription;
          const customerId = subscription.customer as string;

          logStep("Processing customer.subscription.created", { 
            subscriptionId: subscription.id, 
            customerId,
            status: subscription.status
          });

          // Buscar dados do cliente no Stripe
          const customer = await stripe.customers.retrieve(customerId);
          
          if ((customer as any).deleted) {
            logStep("Customer was deleted, skipping");
            break;
          }

          const customerData = customer as Stripe.Customer;
          const email = customerData.email;
          const customerName = customerData.name || email?.split('@')[0] || 'Usuário';

          if (!email) {
            logStep("No email found for customer, skipping user creation");
            break;
          }

          logStep("Customer data retrieved", { email, customerName });

          // Verificar se já existe subscription para este customer
          const { data: existingSubByCustomer } = await supabaseClient
            .from("user_subscriptions")
            .select("user_id")
            .eq("stripe_customer_id", customerId)
            .single();

          // Verificar se já existe subscription para esta subscription_id
          const { data: existingSubById } = await supabaseClient
            .from("user_subscriptions")
            .select("user_id")
            .eq("stripe_subscription_id", subscription.id)
            .single();

          if (existingSubByCustomer || existingSubById) {
            logStep("Subscription already exists, skipping creation", { 
              existingByCustomer: !!existingSubByCustomer, 
              existingById: !!existingSubById 
            });
            break;
          }

          // Verificar se já existe usuário com este email
          const { data: existingUsers } = await supabaseClient.auth.admin.listUsers();
          const userExists = existingUsers?.users?.find(u => u.email === email);

          // Calculate fallback based on subscription interval
          const now = new Date();
          const interval = subscription.items.data[0]?.price?.recurring?.interval || 'month';
          const intervalCount = subscription.items.data[0]?.price?.recurring?.interval_count || 1;
          
          const fallbackPeriodEnd = new Date(now);
          if (interval === 'year') {
            fallbackPeriodEnd.setFullYear(fallbackPeriodEnd.getFullYear() + intervalCount);
          } else if (interval === 'month') {
            fallbackPeriodEnd.setMonth(fallbackPeriodEnd.getMonth() + intervalCount);
          } else if (interval === 'week') {
            fallbackPeriodEnd.setDate(fallbackPeriodEnd.getDate() + (7 * intervalCount));
          } else if (interval === 'day') {
            fallbackPeriodEnd.setDate(fallbackPeriodEnd.getDate() + intervalCount);
          }
          
          const periodStart = safeTimestampToISO(subscription.current_period_start) || now.toISOString();
          const periodEnd = safeTimestampToISO(subscription.current_period_end) || fallbackPeriodEnd.toISOString();

          // Determinar document_limit e plan_name baseado no preço
          const priceId = subscription.items.data[0]?.price?.id;
          const { limit: documentLimit, name: planName } = getPlanFromPriceId(priceId);

          logStep("Plan determined from price", { priceId, documentLimit, planName });

          if (!userExists) {
            // Criar novo usuário
            logStep("Creating new user from manual subscription", { email, customerName });
            
            const tempPassword = email.split('@')[0] + Math.random().toString(36).slice(-4);
            
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

            // Criar company_settings
            const { error: companyError } = await supabaseClient.from("company_settings").insert({
              user_id: newUser.user.id,
              company_name: customerName,
              cnpj: "00.000.000/0000-00",
              admin_name: customerName,
              admin_cpf: "000.000.000-00",
              admin_phone: "(00)00000-0000",
              admin_email: email,
            });

            if (companyError) {
              logStep("Error creating company settings", { error: companyError.message });
            } else {
              logStep("Company settings created");
            }

            // Criar subscription
            const { error: subError } = await supabaseClient.from("user_subscriptions").insert({
              user_id: newUser.user.id,
              stripe_customer_id: customerId,
              stripe_subscription_id: subscription.id,
              stripe_price_id: priceId || null,
              plan_name: planName,
              status: subscription.status as any,
              current_period_start: periodStart,
              current_period_end: periodEnd,
              cancel_at_period_end: subscription.cancel_at_period_end || false,
              document_limit: documentLimit === -1 ? 999999 : documentLimit, // -1 = ilimitado, usar número grande
            });

            if (subError) {
              logStep("Error creating subscription", { error: subError.message });
              throw subError;
            }

            logStep("Subscription created");

            // Enviar email de boas-vindas
            try {
              const welcomeResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-welcome-email`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
                },
                body: JSON.stringify({
                  email,
                  name: customerName,
                  userId: newUser.user.id,
                  tempPassword,
                  organizationName: customerName,
                  tierName: planName,
                }),
              });

              if (welcomeResponse.ok) {
                logStep("Welcome email sent successfully");
              } else {
                const errorText = await welcomeResponse.text();
                logStep("Warning: Welcome email failed", { status: welcomeResponse.status, error: errorText });
              }
            } catch (emailError) {
              logStep("Warning: Welcome email failed", { error: String(emailError) });
            }
          } else {
            // Usuário existe mas não tem subscription - criar subscription
            logStep("User exists, creating subscription", { userId: userExists.id });
            
            const { error: subError } = await supabaseClient.from("user_subscriptions").insert({
              user_id: userExists.id,
              stripe_customer_id: customerId,
              stripe_subscription_id: subscription.id,
              stripe_price_id: priceId || null,
              plan_name: planName,
              status: subscription.status as any,
              current_period_start: periodStart,
              current_period_end: periodEnd,
              cancel_at_period_end: subscription.cancel_at_period_end || false,
              document_limit: documentLimit === -1 ? 999999 : documentLimit,
            });

            if (subError) {
              logStep("Error creating subscription for existing user", { error: subError.message });
              throw subError;
            }

            logStep("Subscription created for existing user");
          }

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
