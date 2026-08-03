"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import ChartWheel from "@/components/ChartWheel";
import type { NatalChart, NumerologyProfile } from "@/lib/api";
import { zodiacSign } from "@/lib/astrology";
import { createClient } from "@/lib/supabase/client";

type ClientDetail = {
  id: string;
  full_name: string;
  birth_date: string;
  chart: NatalChart;
  numerology: NumerologyProfile;
};

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const [client, setClient] = useState<ClientDetail | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from("clients")
        .select("id, full_name, birth_date, chart, numerology")
        .eq("id", params.id)
        .maybeSingle();
      if (cancelled) return;
      if (fetchError || !data) {
        setError("Couldn't find this client — they may have been removed.");
        setClient(null);
        return;
      }
      setClient(data as ClientDetail);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  if (client === undefined) return null;

  if (error || !client) {
    return (
      <section className="screen active" id="client-detail">
        <p style={{ color: "#c96a4a", fontSize: 14 }}>{error ?? "Client not found."}</p>
        <Link className="btn btn-ghost" href="/clients" style={{ marginTop: 16, display: "inline-block" }}>
          Back to clients
        </Link>
      </section>
    );
  }

  const sun = client.chart.planets.find((p) => p.name === "Sun");
  const risingSign = client.chart.ascendant !== null ? zodiacSign(client.chart.ascendant) : null;

  return (
    <section className="screen active" id="client-detail">
      <div className="print-hide" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link href="/clients" style={{ color: "var(--text-dim)", fontSize: 13 }}>
          ← Back to clients
        </Link>
        <button className="btn btn-ghost" onClick={() => window.print()}>
          Save as PDF / Print
        </button>
      </div>
      <h2 style={{ margin: "12px 0 24px" }}>{client.full_name}</h2>

      <div className="card" style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
        <ChartWheel chart={client.chart} />
      </div>

      <div className="dash-grid">
        <div>
          <div className="card">
            <div className="label">Snapshot</div>
            <div className="stat-row">
              <div className="stat">
                <div className="val">{client.numerology.life_path}</div>
                <div className="lbl">Life Path</div>
              </div>
              <div className="stat">
                <div className="val">{sun?.sign ?? "—"}</div>
                <div className="lbl">Sun</div>
              </div>
              <div className="stat">
                <div className="val">{risingSign ?? "—"}</div>
                <div className="lbl">Rising</div>
              </div>
            </div>
          </div>
          {client.chart.patterns.length > 0 && (
            <div className="card">
              <div className="label">Chart patterns</div>
              {client.chart.patterns.map((pattern, i) => (
                <p key={i} style={{ margin: i === 0 ? "0 0 6px" : "6px 0" }}>
                  <strong style={{ color: "var(--text)" }}>{pattern.pattern_type}</strong> — {pattern.planets.join(", ")}
                  {pattern.apex && ` (apex: ${pattern.apex})`}
                </p>
              ))}
            </div>
          )}
        </div>
        <div>
          <div className="card">
            <div className="label">Planets</div>
            <ul style={{ margin: 0, paddingLeft: 18, color: "var(--text-dim)", fontSize: 14 }}>
              {client.chart.planets.map((p) => (
                <li key={p.name}>
                  {p.name} in {p.sign} {p.house !== null && `· House ${p.house}`}
                  {p.retrograde ? " (retrograde)" : ""}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
