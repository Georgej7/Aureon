"use client";

import { useState } from "react";

const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <path d="M3 3l18 18" />
    <path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c7 0 10.5 7 10.5 7a13.5 13.5 0 0 1-3.1 4M6.6 6.6C3.4 8.6 1.5 12 1.5 12s3.5 7 10.5 7c1.4 0 2.7-.3 3.9-.7" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </svg>
);

// Reused by login and register -- neither had a way to check what you'd
// typed, which matters more than usual here since a wrong password on
// registration means locking yourself out of an account you just made.
export default function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="field">
      <label>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          type={visible ? "text" : "password"}
          value={value}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          style={{ paddingRight: 42 }}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          style={{
            position: "absolute", top: "50%", right: 12, transform: "translateY(-50%)",
            background: "none", border: "none", padding: 0, cursor: "pointer",
            color: "var(--text-dim)", display: "flex", alignItems: "center",
          }}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </div>
  );
}
