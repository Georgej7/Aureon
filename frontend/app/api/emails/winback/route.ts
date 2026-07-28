import { NextResponse, type NextRequest } from "next/server";
import { sendEmail } from "@/lib/email/resend";
import { winBackDay14Email, winBackDay30Email, winBackDay60Email } from "@/lib/email/templates";

const TEMPLATES = {
  day14: winBackDay14Email,
  day30: winBackDay30Email,
  day60: winBackDay60Email,
} as const;

/**
 * Manual-trigger endpoint for the win-back sequence — there's no
 * inactivity-detection cron yet (tracking is spreadsheet-level at this
 * stage, per the marketing plan), so this is a deliberate send-one-at-a-time
 * utility rather than an automated pipeline. Guarded by a shared secret
 * since, unlike the welcome email, this isn't called from any public page —
 * it only ever fires from Gio's own manual outreach.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.ADMIN_EMAIL_SECRET;
  if (!secret || request.headers.get("x-admin-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { email, stage, fullName } = await request.json();
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Missing email" }, { status: 400 });
  }
  const buildTemplate = TEMPLATES[stage as keyof typeof TEMPLATES];
  if (!buildTemplate) {
    return NextResponse.json({ error: `stage must be one of: ${Object.keys(TEMPLATES).join(", ")}` }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const { subject, html } = buildTemplate({ appUrl, fullName });

  try {
    await sendEmail({ to: email, subject, html });
  } catch (err) {
    console.error("Win-back email failed", err);
    return NextResponse.json({ error: "Send failed" }, { status: 500 });
  }

  return NextResponse.json({ sent: true });
}
