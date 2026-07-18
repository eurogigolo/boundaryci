import Stripe from "npm:stripe@22.3.2";
import { json } from "../_shared/http.ts";
import { syncStripeSubscription } from "../_shared/supabase.ts";
import {
  planForPrice,
  stripeClient,
  webhookSecret,
} from "../_shared/stripe.ts";

type SupportedStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid"
  | "paused";

interface FlexibleSubscription extends Stripe.Subscription {
  current_period_start?: number;
  current_period_end?: number;
}

function customerId(subscription: Stripe.Subscription): string | null {
  return typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer?.id ?? null;
}

function timestamp(value: number | null | undefined): string | null {
  return typeof value === "number"
    ? new Date(value * 1000).toISOString()
    : null;
}

function supportedStatus(value: string): SupportedStatus | null {
  return [
      "trialing",
      "active",
      "past_due",
      "canceled",
      "incomplete",
      "incomplete_expired",
      "unpaid",
      "paused",
    ].includes(value)
    ? value as SupportedStatus
    : null;
}

async function synchronize(
  event: Stripe.Event,
  subscription: Stripe.Subscription,
): Promise<boolean> {
  const item = subscription.items.data[0];
  const priceId = item?.price?.id;
  const configuration = priceId ? planForPrice(priceId) : null;
  const stripeCustomerId = customerId(subscription);
  const status = supportedStatus(subscription.status);
  if (!configuration || !priceId || !stripeCustomerId || !status) {
    console.warn(
      "Ignoring a Stripe subscription that is not mapped to BoundaryCI.",
      {
        eventId: event.id,
        eventType: event.type,
        priceId,
      },
    );
    return false;
  }

  const flexible = subscription as FlexibleSubscription;
  const flexibleItem = item as typeof item & {
    current_period_start?: number;
    current_period_end?: number;
  };
  const organizationId = subscription.metadata?.boundaryci_organization_id;

  return syncStripeSubscription({
    stripe_event_id: event.id,
    stripe_event_type: event.type,
    target_organization_id: organizationId || null,
    customer_id: stripeCustomerId,
    subscription_id: subscription.id,
    price_id: priceId,
    next_plan: configuration.plan,
    next_status: status,
    next_billing_interval: configuration.stripeInterval,
    period_start: timestamp(
      flexible.current_period_start ?? flexibleItem?.current_period_start,
    ),
    period_end: timestamp(
      flexible.current_period_end ?? flexibleItem?.current_period_end,
    ),
    ends_at_period_end: subscription.cancel_at_period_end,
  });
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return json(request, 405, { error: "Method not allowed." });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return json(request, 400, { error: "Stripe signature is required." });
  }
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    const stripe = stripeClient();
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret(),
      undefined,
      Stripe.createSubtleCryptoProvider(),
    );
  } catch (caught) {
    console.warn("BoundaryCI rejected a Stripe webhook signature.", caught);
    return json(request, 400, { error: "Invalid Stripe signature." });
  }

  try {
    let processed = false;
    if (
      [
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
      ].includes(event.type)
    ) {
      processed = await synchronize(
        event,
        event.data.object as Stripe.Subscription,
      );
    } else if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const subscriptionId = typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id;
      if (session.mode === "subscription" && subscriptionId) {
        const subscription = await stripeClient().subscriptions.retrieve(
          subscriptionId,
        );
        processed = await synchronize(event, subscription);
      }
    }
    return json(request, 200, { received: true, processed });
  } catch (caught) {
    console.error("BoundaryCI failed to process a Stripe webhook.", {
      eventId: event.id,
      eventType: event.type,
      error: caught,
    });
    return json(request, 500, { error: "Webhook processing failed." });
  }
});
