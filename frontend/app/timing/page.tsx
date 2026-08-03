"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ElectionalDay, SubscriptionTier } from "@/lib/api";
import { postFinancialTiming } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

type ProfileRow = {
  birth_date: string | null;
  subscription_tier: SubscriptionTier;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function TimingPage() {
  const [tier, setTier] = useState<SubscriptionTier | undefined>(undefined);
  const [hasProfile, setHasProfile] = useState<boolean | undefined>(undefined);
  const [birthDate, setBirthDate] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(todayIso());
  const [days, setDays] = useState<ElectionalDay[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        if (!cancelled) {
          setTier("free");
          setLoading(false);
        }
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("birth_date, subscription_tier")
        .eq("id", session.user.id)
        .maybeSingle<ProfileRow>();
      if (cancelled) return;
      setTier(data?.subscription_tier ?? "free");
      setHasProfile(!!data?.birth_date);
      setBirthDate(data?.birth_date ?? null);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleScan() {
    if (!birthDate) return;
    setScanning(true);
    setError(null);
    setDays(null);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError("Your session expired — please sign in again.");
        return;
      }
      const result = await postFinancialTiming(
        { birth_date: birthDate, start_date: startDate, days: 30 },
        session.access_token
      );
      setDays(result.days);
    } catch {
      setError("Couldn't run the scan — is the backend running? Try again in a moment.");
    } finally {
      setScanning(false);
    }
  }

  if (tier === undefined || loading) return null;

  if (tier === "free") {
    return (
      <section className="screen active" id="timing">
        <div className="onboard-wrap">
          <div className="onboard-card hud">
            <span className="hud-tag">Premium feature</span>
            <h2>Financial timing</h2>
            <p className="sub">
              A day-by-day favorability read for financial decisions — combining your personal
              numerology cycle with real astronomical signals like Mercury retrograde. Part of
              Aureon Premium.
            </p>
            <Link className="btn btn-gold" href="/pricing">
              Upgrade to Premium
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (!hasProfile) {
    return (
      <section className="screen active" id="timing">
        <div className="onboard-wrap">
          <div className="onboard-card hud">
            <span className="hud-tag">Financial timing</span>
            <h2>Complete your profile first</h2>
            <p className="sub">
              This reading is built from your own numerology cycle — create your profile to use it.
            </p>
            <Link className="btn btn-gold" href="/onboarding">
              Create your profile
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="screen active" id="timing">
      <p className="eyebrow" style={{ marginBottom: 8 }}>
        Personal Day numerology · real transits
      </p>
      <h2 style={{ margin: "0 0 12px" }}>Financial timing</h2>
      <p className="sub" style={{ maxWidth: 640, marginBottom: 24 }}>
        A favorability signal for money-related decisions — a loan, a big purchase, signing a
        contract — built from your Personal Day number and whether Mercury is actually
        retrograde that day. This is reflection to consider alongside real financial advice,
        not a substitute for it.
      </p>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="field">
          <label htmlFor="start-date">Starting from</label>
          <input
            id="start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        {error && <p style={{ color: "#c96a4a", fontSize: 13, margin: "10px 0 0" }}>{error}</p>}
        <button
          className="btn btn-gold"
          style={{ marginTop: 14, opacity: scanning ? 0.6 : 1 }}
          onClick={handleScan}
          disabled={scanning}
        >
          {scanning ? "Scanning…" : "Scan the next 30 days"}
        </button>
      </div>

      {days && (
        <div className="card">
          <div className="label">Next 30 days</div>
          <ul style={{ margin: "12px 0 0", padding: 0, listStyle: "none" }}>
            {days.map((d) => (
              <li
                key={d.date}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 0",
                  borderBottom: "1px solid var(--line)",
                  opacity: d.mercury_retrograde ? 0.55 : 1,
                }}
              >
                <span style={{ fontSize: 14 }}>{d.date}</span>
                <span style={{ fontSize: 13, color: "var(--text-dim)" }}>
                  Personal Day {d.personal_day_number}
                  {d.favorable_numerology && !d.mercury_retrograde ? " · favorable" : ""}
                  {d.mercury_retrograde ? " · Mercury retrograde" : ""}
                  {" · "}
                  {d.moon_phase}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
