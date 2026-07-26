import { NextResponse, type NextRequest } from "next/server";
import { sendEmail } from "@/lib/email/resend";
import { welcomeEmail } from "@/lib/email/templates";

export async function POST(request: NextRequest) {
  const { email } = await request.json();
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Missing email" }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const { subject, html } = welcomeEmail({ appUrl });

  // Best-effort — a failed welcome email should never block or fail signup,
  // which already succeeded by the time this route is called.
  try {
    await sendEmail({ to: email, subject, html });
  } catch (err) {
    console.error("Welcome email failed", err);
  }

  return NextResponse.json({ sent: true });
}
