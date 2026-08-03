"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { initializePaddle, type Paddle } from "@paddle/paddle-js";
import { trackEvent } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/client";

export default function PricingPage() {
  const router = useRouter();
  const [paddle, setPaddle] = useState<Paddle>();
  const [error, setError] = useState<string | null>(null);
  const [vipError, setVipError] = useState<string | null>(null);
  const [practitionerError, setPractitionerError] = useState<string | null>(null);
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");

  useEffect(() => {
    const clientToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
    if (!clientToken) return;

    initializePaddle({
      token: clientToken,
      environment: process.env.NEXT_PUBLIC_PADDLE_ENV === "production" ? "production" : "sandbox",
      eventCallback: (event) => {
        if (event.name === "checkout.completed") {
          router.push("/dashboard?upgraded=1");
        }
      },
    }).then(setPaddle);
  }, [router]);

  async function openCheckout(
    tier: "premium" | "vip" | "practitioner",
    monthlyEnvVar: string | undefined,
    annualEnvVar: string | undefined,
    setErrorFn: (msg: string | null) => void
  ) {
    setErrorFn(null);
    const priceId = billing === "annual" ? annualEnvVar : monthlyEnvVar;
    if (!paddle || !priceId) {
      setErrorFn(
        billing === "annual"
          ? "Annual billing isn't available yet — try monthly for now."
          : "Billing isn't configured yet."
      );
      return;
    }

    // Fetched fresh here (rather than read from state set in the effect
    // above) so a click right after page load can't race an in-flight
    // getUser() call and misfire the "not signed in" redirect.
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    trackEvent("checkout_started", { tier, billing });
    paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      ...(user.email && { customer: { email: user.email } }),
      customData: { supabase_user_id: user.id },
    });
  }

  function goPremium() {
    return openCheckout(
      "premium",
      process.env.NEXT_PUBLIC_PADDLE_PREMIUM_PRICE_ID,
      process.env.NEXT_PUBLIC_PADDLE_PREMIUM_ANNUAL_PRICE_ID,
      setError
    );
  }

  function goVip() {
    return openCheckout(
      "vip",
      process.env.NEXT_PUBLIC_PADDLE_VIP_PRICE_ID,
      process.env.NEXT_PUBLIC_PADDLE_VIP_ANNUAL_PRICE_ID,
      setVipError
    );
  }

  function goPractitioner() {
    return openCheckout(
      "practitioner",
      process.env.NEXT_PUBLIC_PADDLE_PRACTITIONER_PRICE_ID,
      process.env.NEXT_PUBLIC_PADDLE_PRACTITIONER_ANNUAL_PRICE_ID,
      setPractitionerError
    );
  }

  return (
    <section className="screen active" id="pricing">
      <div className="billing-toggle">
        <button
          className={billing === "monthly" ? "active" : ""}
          onClick={() => setBilling("monthly")}
        >
          Monthly
        </button>
        <button
          className={billing === "annual" ? "active" : ""}
          onClick={() => setBilling("annual")}
        >
          Annual <span className="save-tag">Save 17%</span>
        </button>
      </div>
      <div className="price-grid">
        <div className="plan">
          <div className="tier">Free</div>
          <div className="price">$0</div>
          <ul>
            <li>Full natal chart + core numbers</li>
            <li>3 AI messages per day</li>
            <li>Daily insight</li>
          </ul>
          <button className="btn btn-ghost">Start free</button>
        </div>
        <div className="plan featured">
          <div className="badge">Most popular</div>
          <div className="tier">Premium</div>
          {billing === "annual" ? (
            <>
              <div className="price">
                $149 <span>/ year</span>
              </div>
              <p className="price-note">Just $12.42/mo billed annually — 2 months free</p>
            </>
          ) : (
            <div className="price">
              $14.99 <span>/ month</span>
            </div>
          )}
          <ul>
            <li>Unlimited AI conversations</li>
            <li>Full reports — love, career, money</li>
            <li>Compatibility analysis</li>
            <li>Long-term memory</li>
          </ul>
          <button className="btn btn-gold" onClick={goPremium}>
            Go Premium
          </button>
          {error && <p style={{ color: "#c96a4a", fontSize: 13, marginTop: 8 }}>{error}</p>}
        </div>
        <div className="plan">
          <div className="tier">VIP</div>
          {billing === "annual" ? (
            <>
              <div className="price">
                $590 <span>/ year</span>
              </div>
              <p className="price-note">Just $49.17/mo billed annually — 2 months free</p>
            </>
          ) : (
            <div className="price">
              $59 <span>/ month</span>
            </div>
          )}
          <ul>
            <li>Everything in Premium</li>
            <li>Personal room feng shui — Bagua zone mapping</li>
            <li>Cross-referenced with your own Kua directions</li>
          </ul>
          <button className="btn btn-gold" onClick={goVip}>
            Go VIP
          </button>
          {vipError && <p style={{ color: "#c96a4a", fontSize: 13, marginTop: 8 }}>{vipError}</p>}
        </div>
        <div className="plan">
          <div className="tier">Practitioner</div>
          {billing === "annual" ? (
            <>
              <div className="price">
                $990 <span>/ year</span>
              </div>
              <p className="price-note">Just $82.50/mo billed annually — 2 months free</p>
            </>
          ) : (
            <div className="price">
              $99 <span>/ month</span>
            </div>
          )}
          <ul>
            <li>Everything in Premium</li>
            <li>Client roster — unlimited saved charts for real client work</li>
            <li>Full chart wheel + PDF/print reports to hand clients</li>
            <li>Solar return, progressions, composite &amp; Davison charts</li>
          </ul>
          <button className="btn btn-gold" onClick={goPractitioner}>
            Go Practitioner
          </button>
          {practitionerError && (
            <p style={{ color: "#c96a4a", fontSize: 13, marginTop: 8 }}>{practitionerError}</p>
          )}
        </div>
      </div>
      <footer className="note">
        For reflection and self-development purposes. Not a substitute for professional financial,
        legal, or medical advice.
      </footer>
    </section>
  );
}
