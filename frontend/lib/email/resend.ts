import { Resend } from "resend";

// Mirrors the ANTHROPIC_API_KEY stub-mode pattern in backend/app/ai/claude.py —
// no RESEND_API_KEY means emails are logged, not sent, rather than throwing.
// Lets the rest of the app (signup, webhooks) call this unconditionally.
const FROM_ADDRESS = process.env.RESEND_FROM_ADDRESS ?? "Aureon <onboarding@resend.dev>";

export async function sendEmail(params: { to: string; subject: string; html: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[email stub — no RESEND_API_KEY] Would send "${params.subject}" to ${params.to}`);
    return;
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });
  if (error) {
    console.error("Resend send failed", { to: params.to, subject: params.subject, error });
  }
}
