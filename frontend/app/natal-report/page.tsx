"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ElementModalityBreakdown from "@/components/ElementModalityBreakdown";
import NatalPlacementList from "@/components/NatalPlacementList";
import PositionTable from "@/components/PositionTable";
import type { NatalChart } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

export default function NatalReportPage() {
  const [chart, setChart] = useState<NatalChart | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        if (!cancelled) setChart(null);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("chart")
        .eq("id", session.user.id)
        .maybeSingle<{ chart: NatalChart | null }>();
      if (!cancelled) setChart(data?.chart ?? null);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (chart === undefined) return null;

  if (!chart) {
    return (
      <section className="screen active" id="natal-report">
        <div className="onboard-wrap">
          <div className="onboard-card hud">
            <span className="hud-tag">Full natal reading</span>
            <h2>Complete your profile first</h2>
            <p className="sub">Create your profile to see your full placement-by-placement reading.</p>
            <Link className="btn btn-gold" href="/onboarding">
              Create your profile
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="screen active" id="natal-report">
      <p className="eyebrow" style={{ marginBottom: 8 }}>
        Every placement, explained
      </p>
      <h2 style={{ margin: "0 0 12px" }}>Full natal reading</h2>
      <p className="sub" style={{ maxWidth: 640, marginBottom: 24 }}>
        Tap any placement to expand its full interpretation — traditional, modern, and
        psychological readings, plus strengths, challenges, career, relationships, and growth.
      </p>
      <div className="dash-grid" style={{ marginBottom: 20 }}>
        <PositionTable chart={chart} />
        <ElementModalityBreakdown chart={chart} />
      </div>
      <NatalPlacementList chart={chart} />
    </section>
  );
}
