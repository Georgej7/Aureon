import { NextResponse } from "next/server";
import { getPaddleClient } from "@/lib/paddle/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("paddle_subscription_id")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile?.paddle_subscription_id) {
    return NextResponse.json({ error: "No active subscription found." }, { status: 404 });
  }

  const subscription = await getPaddleClient().subscriptions.get(profile.paddle_subscription_id);

  return NextResponse.json({
    updatePaymentMethod: subscription.managementUrls?.updatePaymentMethod ?? null,
    cancel: subscription.managementUrls?.cancel ?? null,
  });
}
