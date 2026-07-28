// Email HTML needs inline styles and a light background — most email clients
// strip <style> blocks unreliably and render poorly against dark backgrounds,
// unlike the app itself. Kept visually distinct from the site's dark/gold
// look but still branded: same gold accent, same serif for headings.

const GOLD = "#a5792f"; // deepened from the app's #c9a24a — the lighter app gold
// fails contrast on a white email background, same reasoning as the light-theme
// token adjustment on the founder's-plan page.
const TEXT = "#241f18";
const TEXT_DIM = "#5c5346";
const BORDER = "#e5ddc9";

function wrapper(bodyHtml: string): string {
  return `
<div style="background:#f6f1e6;padding:40px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid ${BORDER};border-radius:14px;padding:36px 32px;">
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:20px;color:${TEXT};margin-bottom:28px;">
      <span style="color:${GOLD};">✦</span> Aureon
    </div>
    ${bodyHtml}
    <div style="margin-top:32px;padding-top:20px;border-top:1px solid ${BORDER};font-size:12px;color:${TEXT_DIM};">
      Aureon — reflection through astrology and numerology.
    </div>
  </div>
</div>`.trim();
}

function heading(text: string): string {
  return `<h1 style="font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:24px;color:${TEXT};margin:0 0 16px;line-height:1.3;">${text}</h1>`;
}

function paragraph(text: string): string {
  return `<p style="font-size:14.5px;line-height:1.7;color:${TEXT_DIM};margin:0 0 16px;">${text}</p>`;
}

function button(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;background:${GOLD};color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:8px;margin-top:8px;">${label}</a>`;
}

export function welcomeEmail(params: { appUrl: string }): { subject: string; html: string } {
  return {
    subject: "Welcome to Aureon",
    html: wrapper(
      heading("Welcome — the sky's been waiting.") +
        paragraph(
          "Your account is ready. The next step is building your profile — your birth chart and numerology, the foundation everything else in Aureon reads from."
        ) +
        paragraph(
          "Once that's done, your dashboard fills in with real, current data: today's transits, your moon phase, and an AI companion that actually remembers your chart from one conversation to the next."
        ) +
        button("Create your profile", `${params.appUrl}/onboarding`)
    ),
  };
}

export function subscriptionCanceledEmail(params: { appUrl: string }): { subject: string; html: string } {
  return {
    subject: "Your Aureon Premium subscription has been canceled",
    html: wrapper(
      heading("Your subscription has ended.") +
        paragraph(
          "Your Premium access has been canceled — you won't be billed again. Your account, chart, and conversation history are all still here whenever you come back."
        ) +
        paragraph(
          "If this was a mistake, or you'd like to resubscribe, you can do that anytime from the pricing page."
        ) +
        button("View pricing", `${params.appUrl}/pricing`)
    ),
  };
}

export function resubscribedEmail(params: { appUrl: string }): { subject: string; html: string } {
  return {
    subject: "You're back — welcome to Premium",
    html: wrapper(
      heading("Good to have you back.") +
        paragraph(
          "Your Aureon Premium subscription is active again — unlimited conversations, full reports, and everything else Premium includes."
        ) +
        button("Open your dashboard", `${params.appUrl}/dashboard`)
    ),
  };
}

// Win-back / lapsed-user sequence — three touches, day 14 / 30 / 60 of no
// return visit. Deliberately gentle at every step: no fake urgency, no
// scarcity, no guilt ("we miss you 😢") — the brand voice rules out
// manipulative retention tactics explicitly, and this category (spiritual
// self-development) carries real trust stakes if it reads as manufactured
// neediness. Each step gets quieter and lower-pressure than the last, not
// more insistent — the opposite of a typical win-back escalation.

function greet(fullName?: string): string {
  return fullName?.trim() ? `${fullName.trim().split(" ")[0]}, ` : "";
}

export function winBackDay14Email(params: { appUrl: string; fullName?: string }): {
  subject: string;
  html: string;
} {
  return {
    subject: "Your chart's still here",
    html: wrapper(
      heading(`${greet(params.fullName)}your chart's still here.`) +
        paragraph(
          "It's been a couple of weeks. Nothing's changed on our end — your profile, your numbers, and any conversation history are exactly where you left them."
        ) +
        paragraph(
          "No pressure to have a reason to come back. If something's on your mind, that's usually reason enough."
        ) +
        button("Open your dashboard", `${params.appUrl}/dashboard`)
    ),
  };
}

export function winBackDay30Email(params: { appUrl: string; fullName?: string }): {
  subject: string;
  html: string;
} {
  return {
    subject: "A month's a real amount of sky to catch up on",
    html: wrapper(
      heading(`${greet(params.fullName)}a month's a real amount of sky to catch up on.`) +
        paragraph(
          "The transits haven't stopped moving just because you stepped away — there's a real gap now between what your chart was tracking a month ago and what it's tracking today."
        ) +
        paragraph(
          "Worth five minutes if you're curious what's shifted. Worth nothing at all if you're not — either way, we're not going anywhere."
        ) +
        button("See what's current", `${params.appUrl}/dashboard`)
    ),
  };
}

export function winBackDay60Email(params: { appUrl: string; fullName?: string }): {
  subject: string;
  html: string;
} {
  return {
    subject: "Still here whenever that's useful",
    html: wrapper(
      heading(`${greet(params.fullName)}still here whenever that's useful.`) +
        paragraph(
          "This is the last one of these you'll get for a while — not because we're giving up, just because three nudges is enough. Your account and history aren't going anywhere."
        ) +
        paragraph("If now's genuinely not the right time, that's a completely fine answer.") +
        button("Come back anytime", `${params.appUrl}/dashboard`)
    ),
  };
}
