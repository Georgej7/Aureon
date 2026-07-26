import { NextResponse, type NextRequest } from "next/server";
import { EventName } from "@paddle/paddle-node-sdk";
import { getPaddleClient } from "@/lib/paddle/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { subscriptionCanceledEmail, resubscribedEmail } from "@/lib/email/templates";

// Best-effort — a failed notification email should never fail webhook
// processing, which is what actually keeps billing state correct.
async function notifyUser(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  build: (params: { appUrl: string }) => { subject: string; html: string }
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://aureon-frontend.onrender.com";
  try {
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (error || !data.user?.email) return;
    const { subject, html } = build({ appUrl });
    await sendEmail({ to: data.user.email, subject, html });
  } catch (err) {
    console.error("Paddle webhook: notification email failed", err);
  }
}

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
  let dbError: { message: string } | null = null;

  switch (event.eventType) {
    case EventName.SubscriptionCreated: {
      const subscription = event.data;
      const userId = subscription.customData?.supabase_user_id as string | undefined;
      if (userId) {
        const { tier, status } = mapSubscriptionStatus(subscription.status);
        const { error } = await supabase
          .from("profiles")
          .update({
            subscription_tier: tier,
            subscription_status: status,
            paddle_customer_id: subscription.customerId,
            paddle_subscription_id: subscription.id,
          })
          .eq("id", userId);
        dbError = error;
      }
      break;
    }

    case EventName.SubscriptionUpdated: {
      const subscription = event.data;
      const { tier, status } = mapSubscriptionStatus(subscription.status);

      const { data: existing } = await supabase
        .from("profiles")
        .select("id, subscription_status")
        .eq("paddle_customer_id", subscription.customerId)
        .single();

      const { error } = await supabase
        .from("profiles")
        .update({
          subscription_tier: tier,
          subscription_status: status,
          paddle_subscription_id: tier === "free" ? null : subscription.id,
        })
        .eq("paddle_customer_id", subscription.customerId);
      dbError = error;

      const isReactivation = existing?.subscription_status === "canceled" && status === "active";
      if (!error && isReactivation && existing?.id) {
        await notifyUser(supabase, existing.id, resubscribedEmail);
      }
      break;
    }

    case EventName.SubscriptionCanceled: {
      const subscription = event.data;

      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("paddle_customer_id", subscription.customerId)
        .single();

      const { error } = await supabase
        .from("profiles")
        .update({
          subscription_tier: "free",
          subscription_status: "canceled",
          paddle_subscription_id: null,
        })
        .eq("paddle_customer_id", subscription.customerId);
      dbError = error;

      if (!error && existing?.id) {
        await notifyUser(supabase, existing.id, subscriptionCanceledEmail);
      }
      break;
    }

    default:
      break;
  }

  if (dbError) {
    console.error("Paddle webhook: Supabase update failed", dbError);
    return NextResponse.json({ error: `Database update failed: ${dbError.message}` }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
