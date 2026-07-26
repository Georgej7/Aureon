"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleSubmit() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
    setSubmitting(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    if (data.session) {
      // Email confirmation is disabled on this project — session is active immediately.
      router.push("/onboarding");
      router.refresh();
    } else {
      // Email confirmation required — no session until the user clicks the link.
      setCheckEmail(true);
    }
  }

  return (
    <section className="screen active" id="register">
      <div className="onboard-wrap">
        <div className="onboard-card hud">
          <span className="hud-tag">Create account</span>
          <h2>Start your reading</h2>
          <p className="sub">Just an email and password — your profile comes next.</p>

          {checkEmail ? (
            <p className="sub">
              Check your email to confirm your account, then{" "}
              <Link href="/login" style={{ color: "var(--gold)" }}>
                sign in
              </Link>
              .
            </p>
          ) : (
            <>
              <div className="field">
                <label>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="field">
                <label>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {error && <p style={{ color: "#c96a4a", fontSize: 13, margin: "0 0 8px" }}>{error}</p>}

              <button
                className="btn btn-gold"
                onClick={handleSubmit}
                disabled={submitting || !email || !password}
                style={{ opacity: submitting || !email || !password ? 0.6 : 1 }}
              >
                {submitting ? "Creating account…" : "Create account"}
              </button>
              <p className="sub" style={{ marginTop: 12, fontSize: 12 }}>
                By creating an account you agree to our{" "}
                <Link href="/terms" style={{ color: "var(--gold)" }}>
                  Terms
                </Link>{" "}
                and{" "}
                <Link href="/privacy" style={{ color: "var(--gold)" }}>
                  Privacy Policy
                </Link>
                .
              </p>
              <p className="sub" style={{ marginTop: 16 }}>
                Already have an account?{" "}
                <Link href="/login" style={{ color: "var(--gold)" }}>
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
