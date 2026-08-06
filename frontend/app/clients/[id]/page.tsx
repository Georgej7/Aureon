"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import ChartWheel from "@/components/ChartWheel";
import ElementModalityBreakdown from "@/components/ElementModalityBreakdown";
import NatalPlacementList from "@/components/NatalPlacementList";
import PositionTable from "@/components/PositionTable";
import type { NatalChart, NumerologyProfile } from "@/lib/api";
import { postProgressedChart, postSolarReturn } from "@/lib/api";
import { offsetToIso, zodiacSign } from "@/lib/astrology";
import { createClient } from "@/lib/supabase/client";

type ClientDetail = {
  id: string;
  full_name: string;
  birth_date: string;
  birth_time: string | null;
  latitude: number | null;
  longitude: number | null;
  utc_offset: number | null;
  chart: NatalChart;
  numerology: NumerologyProfile;
};

function currentYear(): number {
  return new Date().getFullYear();
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// A client's stored birth data is enough to recompute any chart type on
// demand -- reused here for Solar return / Progressed instead of only ever
// showing the one natal chart captured when the client was added.
function birthPayload(client: ClientDetail) {
  const hasTime = !!client.birth_time;
  const hasLocation = client.latitude !== null && client.longitude !== null;
  const datetime = `${client.birth_date}T${hasTime ? client.birth_time : "12:00"}:00${offsetToIso(
    client.utc_offset ?? 0
  )}`;
  return {
    datetime,
    time_known: hasTime,
    ...(hasLocation ? { latitude: client.latitude!, longitude: client.longitude! } : {}),
    hasLocation,
  };
}

function ChartSection({
  title,
  blurb,
  chart,
  subtitle,
  error,
}: {
  title: string;
  blurb: string;
  chart: NatalChart | null;
  subtitle: string | null;
  error: string | null;
}) {
  return (
    <div style={{ marginTop: 40 }} className="print-section">
      <h3 style={{ margin: "0 0 4px" }}>{title}</h3>
      <p className="sub" style={{ margin: "0 0 16px", maxWidth: 640 }}>
        {blurb}
        {subtitle && ` — ${subtitle}`}
      </p>
      {error && <p style={{ color: "#c96a4a", fontSize: 13, marginBottom: 16 }}>{error}</p>}
      {chart && (
        <>
          <div className="card" style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
            <ChartWheel chart={chart} />
          </div>
          <div className="dash-grid" style={{ marginBottom: 20 }}>
            <PositionTable chart={chart} />
            <ElementModalityBreakdown chart={chart} />
          </div>
          <NatalPlacementList chart={chart} />
        </>
      )}
    </div>
  );
}

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const [client, setClient] = useState<ClientDetail | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const [solarReturn, setSolarReturn] = useState<NatalChart | null>(null);
  const [solarReturnDate, setSolarReturnDate] = useState<string | null>(null);
  const [solarReturnError, setSolarReturnError] = useState<string | null>(null);

  const [progressed, setProgressed] = useState<NatalChart | null>(null);
  const [progressedDate, setProgressedDate] = useState<string | null>(null);
  const [progressedError, setProgressedError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from("clients")
        .select("id, full_name, birth_date, birth_time, latitude, longitude, utc_offset, chart, numerology")
        .eq("id", params.id)
        .maybeSingle();
      if (cancelled) return;
      if (fetchError || !data) {
        setError("Couldn't find this client — they may have been removed.");
        setClient(null);
        return;
      }
      const row = data as ClientDetail;
      setClient(row);

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session || cancelled) return;

      const { hasLocation, ...birth } = birthPayload(row);

      postSolarReturn(
        { birth, target_year: currentYear(), ...(hasLocation ? { latitude: row.latitude!, longitude: row.longitude! } : {}) },
        session.access_token
      )
        .then((result) => {
          if (cancelled) return;
          setSolarReturn(result.chart);
          setSolarReturnDate(result.exact_datetime);
        })
        .catch(() => {
          if (!cancelled) setSolarReturnError("Couldn't compute this year's solar return.");
        });

      postProgressedChart({ birth, target_date: `${todayIso()}T12:00:00+00:00` }, session.access_token)
        .then((result) => {
          if (cancelled) return;
          setProgressed(result.chart);
          setProgressedDate(result.progressed_datetime);
        })
        .catch(() => {
          if (!cancelled) setProgressedError("Couldn't compute the progressed chart.");
        });
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
      </div>

      <div style={{ marginTop: 40 }}>
        <h3 style={{ margin: "0 0 4px" }}>Full reading</h3>
        <p className="sub" style={{ margin: "0 0 16px", maxWidth: 640 }}>
          Every placement, with traditional, modern, and psychological interpretations.
        </p>
        <div className="dash-grid" style={{ marginBottom: 20 }}>
          <PositionTable chart={client.chart} />
          <ElementModalityBreakdown chart={client.chart} />
        </div>
        <NatalPlacementList chart={client.chart} />
      </div>

      <ChartSection
        title="Solar return"
        blurb={`The chart cast for the exact moment the Sun returns to its natal position in ${currentYear()}`}
        subtitle={solarReturnDate}
        chart={solarReturn}
        error={solarReturnError}
      />

      <ChartSection
        title="Progressed chart"
        blurb="Where the natal chart has symbolically moved to as of today"
        subtitle={progressedDate}
        chart={progressed}
        error={progressedError}
      />
    </section>
  );
}
