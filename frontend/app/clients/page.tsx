"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { postNatalChart, postNumerology, type SubscriptionTier } from "@/lib/api";
import { offsetToIso } from "@/lib/astrology";
import { createClient } from "@/lib/supabase/client";

type ClientRow = {
  id: string;
  full_name: string;
  birth_date: string;
  chart: { planets: { name: string; sign: string }[] } | null;
  created_at: string;
};

export default function ClientsPage() {
  const [tier, setTier] = useState<SubscriptionTier | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [listError, setListError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [utcOffset, setUtcOffset] = useState("0");
  const [birthLocation, setBirthLocation] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const hasLocation = latitude.trim() !== "" && longitude.trim() !== "";
  const locationValid =
    (latitude.trim() === "" || !Number.isNaN(Number(latitude))) &&
    (longitude.trim() === "" || !Number.isNaN(Number(longitude)));
  const hasTime = birthTime.trim() !== "";
  const canSubmit =
    fullName.trim() !== "" && birthDate !== "" && locationValid && !Number.isNaN(Number(utcOffset));

  async function loadClients() {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setTier("free");
      setLoading(false);
      return;
    }
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("subscription_tier")
      .eq("id", session.user.id)
      .maybeSingle<{ subscription_tier: SubscriptionTier }>();
    setTier(profileRow?.subscription_tier ?? "free");

    const { data, error } = await supabase
      .from("clients")
      .select("id, full_name, birth_date, chart, created_at")
      .order("updated_at", { ascending: false });
    if (error) setListError("Couldn't load your client roster — try again in a moment.");
    setClients((data as ClientRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAddClient() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setFormError("Your session expired — please sign in again.");
        return;
      }

      const datetime = `${birthDate}T${hasTime ? birthTime : "12:00"}:00${offsetToIso(Number(utcOffset))}`;
      const [chart, numerology] = await Promise.all([
        postNatalChart(
          {
            datetime,
            time_known: hasTime,
            ...(hasLocation ? { latitude: Number(latitude), longitude: Number(longitude) } : {}),
          },
          session.access_token
        ),
        postNumerology({ full_name: fullName, date: birthDate }, session.access_token),
      ]);

      const { error: insertError } = await supabase.from("clients").insert({
        practitioner_id: session.user.id,
        full_name: fullName,
        birth_date: birthDate,
        birth_time: hasTime ? birthTime : null,
        birth_location: birthLocation,
        latitude: hasLocation ? Number(latitude) : null,
        longitude: hasLocation ? Number(longitude) : null,
        utc_offset: Number(utcOffset),
        time_known: hasTime,
        chart,
        numerology,
      });
      if (insertError) throw insertError;

      setFullName("");
      setBirthDate("");
      setBirthTime("");
      setBirthLocation("");
      setLatitude("");
      setLongitude("");
      setShowForm(false);
      await loadClients();
    } catch {
      setFormError("Couldn't save this client — is the backend running? Try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  }

  if (tier === undefined || loading) return null;

  if (tier !== "practitioner") {
    return (
      <section className="screen active" id="clients">
        <div className="onboard-wrap">
          <div className="onboard-card hud">
            <span className="hud-tag">Practitioner feature</span>
            <h2>Client roster</h2>
            <p className="sub">
              Save and manage charts for multiple people — built for practitioners working with real
              clients, not just your own reading. Part of Aureon Practitioner.
            </p>
            <Link className="btn btn-gold" href="/pricing">
              Upgrade to Practitioner
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="screen active" id="clients">
      <p className="eyebrow" style={{ marginBottom: 8 }}>
        Practitioner tools
      </p>
      <h2 style={{ margin: "0 0 24px" }}>Your clients</h2>

      {listError && <p style={{ color: "#c96a4a", fontSize: 13, marginBottom: 16 }}>{listError}</p>}

      <div className="card" style={{ marginBottom: 24 }}>
        {!showForm ? (
          <button className="btn btn-gold" onClick={() => setShowForm(true)}>
            + Add a client
          </button>
        ) : (
          <>
            <div className="label" style={{ marginBottom: 12 }}>
              New client
            </div>
            <div className="field">
              <label>Full name</label>
              <input placeholder="Jordan Rivera" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="row2">
              <div className="field">
                <label>Date of birth</label>
                <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
              </div>
              <div className="field">
                <label>Birth time (optional)</label>
                <input type="time" value={birthTime} onChange={(e) => setBirthTime(e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label>Birth location</label>
              <input placeholder="Tbilisi, Georgia" value={birthLocation} onChange={(e) => setBirthLocation(e.target.value)} />
            </div>
            <div className="row2">
              <div className="field">
                <label>Latitude (optional)</label>
                <input type="number" step="0.0001" placeholder="41.7151" value={latitude} onChange={(e) => setLatitude(e.target.value)} />
              </div>
              <div className="field">
                <label>Longitude (optional)</label>
                <input type="number" step="0.0001" placeholder="44.8271" value={longitude} onChange={(e) => setLongitude(e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label>UTC offset at birth (e.g. -5, 4, 5.5)</label>
              <input type="number" step="0.5" placeholder="4" value={utcOffset} onChange={(e) => setUtcOffset(e.target.value)} />
            </div>

            {formError && <p style={{ color: "#c96a4a", fontSize: 13, margin: "0 0 8px" }}>{formError}</p>}

            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="btn btn-gold"
                onClick={handleAddClient}
                disabled={!canSubmit || submitting}
                style={{ opacity: !canSubmit || submitting ? 0.6 : 1 }}
              >
                {submitting ? "Reading the sky…" : "Save client"}
              </button>
              <button className="btn btn-ghost" onClick={() => setShowForm(false)} disabled={submitting}>
                Cancel
              </button>
            </div>
          </>
        )}
      </div>

      {clients.length === 0 ? (
        <div className="card">
          <p>No clients yet — add your first one above.</p>
        </div>
      ) : (
        <div className="card">
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {clients.map((c) => {
              const sun = c.chart?.planets.find((p) => p.name === "Sun");
              return (
                <li key={c.id} style={{ borderBottom: "1px solid var(--line)", padding: "12px 0" }}>
                  <Link
                    href={`/clients/${c.id}`}
                    style={{ display: "flex", justifyContent: "space-between", color: "var(--text)", textDecoration: "none" }}
                  >
                    <span>{c.full_name}</span>
                    <span style={{ color: "var(--text-dim)", fontSize: 13 }}>
                      {sun ? `${sun.sign} Sun · ` : ""}
                      {c.birth_date}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
