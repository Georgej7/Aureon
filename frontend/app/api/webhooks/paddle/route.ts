import { NextResponse, type NextRequest } from "next/server";
import { EventName } from "@paddle/paddle-node-sdk";
import { getPaddleClient } from "@/lib/paddle/server";
import { createAdminClient } from "@/lib/supabase/admin";

function mapSubscriptionStatus(status: string): {
  tier: "free" | "premium";
  status: "active" | "past_due" | "canceled" | "incomplete";
} {
  switch (status) {
    case "active":
    case "trialing":
      return { tier: "premium", status: "active" };
    case "past_due":
      return { tier: "premium", status: "past_due" };
    default:
      // paused, canceled
      return { tier: "free", status: "canceled" };
  }
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET;
  const signature = request.headers.get("paddle-signature");
  if (!webhookSecret || !signature) {
    return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
  }

  const rawBody = await request.text();
  const paddle = getPaddleClient();

  let event;
  try {
    event = await paddle.webhooks.unmarshal(rawBody, webhookSecret, signature);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${message}` },
      { status: 400 }
    );
  }

  if (!event) {
    return NextResponse.json({ received: true });
  }

  const supabase = createAdminClient();

  switch (event.eventType) {
    case EventName.SubscriptionCreated: {
      const subscription = event.data;
      const userId = subscription.customData?.supabase_user_id as string | undefined;
      if (userId) {
        const { tier, status } = mapSubscriptionStatus(subscription.status);
        await supabase
          .from("profiles")
          .update({
            subscription_tier: tier,
            subscription_status: status,
            paddle_customer_id: subscription.customerId,
            paddle_subscription_id: subscription.id,
          })
          .eq("id", userId);
      }
      break;
    }

    case EventName.SubscriptionUpdated: {
      const subscription = event.data;
      const { tier, status } = mapSubscriptionStatus(subscription.status);
      await supabase
        .from("profiles")
        .update({
          subscription_tier: tier,
          subscription_status: status,
          paddle_subscription_id: tier === "free" ? null : subscription.id,
        })
        .eq("paddle_customer_id", subscription.customerId);
      break;
    }

    case EventName.SubscriptionCanceled: {
      const subscription = event.data;
      await supabase
        .from("profiles")
        .update({
          subscription_tier: "free",
          subscription_status: "canceled",
          paddle_subscription_id: null,
        })
        .eq("paddle_customer_id", subscription.customerId);
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
