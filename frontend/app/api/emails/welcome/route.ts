import { NextResponse, type NextRequest } from "next/server";
import { sendEmail } from "@/lib/email/resend";
import { welcomeEmail } from "@/lib/email/templates";
import { rateLimit, requestIp } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

// Previously trusted whatever `email` the request body claimed, with no
// authentication and no rate limit -- anyone who found this URL could use
// it to send real email (via Resend) to any address, unlimited times. Now
// requires a real signed-in session and sends only to that account's own
// verified address, ignoring anything the request body claims. The
// frontend's browser Supabase client (RegisterClient.tsx) already has this
// session set as a cookie by the time it calls this route -- signUp()
// establishes the session synchronously on the client, and this project
// currently has email confirmation disabled, so the session exists
// immediately. If email confirmation is ever re-enabled, this call
// silently no-ops until the user has a session (the caller already
// treats it as best-effort/fire-and-forget and swallows failures), rather
// than sending to an unconfirmed, unverified address.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  // Per-user primary, per-IP fallback -- an authenticated user could still
  // otherwise hammer this a lot faster than a real onboarding flow ever
  // would (one welcome email per signup).
  if (!rateLimit(`welcome:user:${user.id}`, 3, 10 * 60 * 1000) || !rateLimit(`welcome:ip:${requestIp(request)}`, 10, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const { subject, html } = welcomeEmail({ appUrl });

  // Best-effort — a failed welcome email should never block or fail signup,
  // which already succeeded by the time this route is called.
  try {
    await sendEmail({ to: user.email, subject, html });
  } catch (err) {
    console.error("Welcome email failed", err);
  }

  return NextResponse.json({ sent: true });
}
