"use client";

import { useEffect, useRef, useState } from "react";

export type LocationValue = {
  displayName: string;
  latitude: number | null;
  longitude: number | null;
};

type GeocodeResult = { displayName: string; latitude: number; longitude: number };

// Birth location was previously two disconnected inputs -- free-text city
// name and separate manual lat/long number fields -- so typing a city never
// actually produced coordinates unless the user separately knew and typed
// their exact birth coordinates. This resolves a typed location to real
// coordinates via /api/geocode (debounced, so it doesn't fire on every
// keystroke), while keeping a manual-entry escape hatch for users who
// already know their exact coordinates or when geocoding turns up nothing.
export default function LocationField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: LocationValue;
  onChange: (next: LocationValue) => void;
}) {
  const [query, setQuery] = useState(value.displayName);
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [manual, setManual] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value.displayName);
  }, [value.displayName]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleQueryChange(next: string) {
    setQuery(next);
    onChange({ displayName: next, latitude: null, longitude: null });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (next.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(next)}`);
        const data = await res.json();
        setResults(data.results ?? []);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
  }

  function selectResult(result: GeocodeResult) {
    setQuery(result.displayName);
    onChange(result);
    setOpen(false);
  }

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <div className="field">
        <label>{label}</label>
        <input
          placeholder="Start typing a city…"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          autoComplete="off"
        />
      </div>
      {open && (
        <div className="tools-menu" style={{ position: "absolute", width: "100%", top: "calc(100% - 4px)" }}>
          {searching && <div className="tools-menu-item">Searching…</div>}
          {!searching && results.length === 0 && (
            <div className="tools-menu-item">No matches — try a nearby larger city, or enter coordinates manually below.</div>
          )}
          {results.map((r, i) => (
            <button
              key={i}
              type="button"
              className="tools-menu-item"
              style={{ textAlign: "left", width: "100%", background: "none", border: "none", cursor: "pointer" }}
              onClick={() => selectResult(r)}
            >
              {r.displayName}
            </button>
          ))}
        </div>
      )}
      {value.latitude !== null && value.longitude !== null && (
        <p className="sub" style={{ marginTop: -8, marginBottom: 12, fontSize: 12 }}>
          {value.latitude.toFixed(4)}, {value.longitude.toFixed(4)}
        </p>
      )}
      <button
        type="button"
        className="btn btn-ghost"
        style={{ fontSize: 12, padding: "4px 10px", marginBottom: 12 }}
        onClick={() => setManual((m) => !m)}
      >
        {manual ? "Hide manual coordinates" : "Enter coordinates manually"}
      </button>
      {manual && (
        <div className="row2">
          <div className="field">
            <label>Latitude</label>
            <input
              type="number"
              step="0.0001"
              placeholder="41.7151"
              value={value.latitude ?? ""}
              onChange={(e) =>
                onChange({ ...value, latitude: e.target.value === "" ? null : Number(e.target.value) })
              }
            />
          </div>
          <div className="field">
            <label>Longitude</label>
            <input
              type="number"
              step="0.0001"
              placeholder="44.8271"
              value={value.longitude ?? ""}
              onChange={(e) =>
                onChange({ ...value, longitude: e.target.value === "" ? null : Number(e.target.value) })
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
