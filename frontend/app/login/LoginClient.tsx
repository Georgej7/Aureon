"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import PasswordField from "@/components/PasswordField";
import { createClient } from "@/lib/supabase/client";

export default function LoginClient() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <section className="screen active" id="login">
      <div className="onboard-wrap">
        <div className="onboard-card hud">
          <span className="hud-tag">Sign in</span>
          <h2>Welcome back</h2>
          <p className="sub">Sign in to continue your reading.</p>

          <div className="field">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <PasswordField label="Password" value={password} onChange={setPassword} autoComplete="current-password" />

          {error && <p style={{ color: "#c96a4a", fontSize: 13, margin: "0 0 8px" }}>{error}</p>}

          <button
            className="btn btn-gold"
            onClick={handleSubmit}
            disabled={submitting || !email || !password}
            style={{ opacity: submitting || !email || !password ? 0.6 : 1 }}
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
          <p className="sub" style={{ marginTop: 16 }}>
            No account yet? <Link href="/register" style={{ color: "var(--gold)" }}>Create one</Link>
          </p>
        </div>
      </div>
    </section>
  );
}
