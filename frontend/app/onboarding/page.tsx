"use client";

import { useRef } from "react";
import ChartReveal, { ChartRevealHandle } from "@/components/ChartReveal";

export default function OnboardingPage() {
  const chartRevealRef = useRef<ChartRevealHandle | null>(null);

  return (
    <section className="screen active" id="onboard">
      <div className="onboard-wrap">
        <div className="step-dots">
          <span className="dot on" />
          <span className="dot" />
          <span className="dot" />
        </div>
        <div className="onboard-card hud">
          <span className="hud-tag">Profile intake</span>
          <h2>Let&apos;s build your profile</h2>
          <p className="sub">Just the essentials for now — your goals come after your first reading.</p>
          <div className="field">
            <label>Full name</label>
            <input placeholder="Jordan Rivera" />
          </div>
          <div className="row2">
            <div className="field">
              <label>Date of birth</label>
              <input placeholder="14 March 1993" />
            </div>
            <div className="field">
              <label>Exact birth time</label>
              <input placeholder="04:12 AM" />
            </div>
          </div>
          <div className="field">
            <label>Birth location</label>
            <input placeholder="Tbilisi, Georgia" />
          </div>
          <button className="btn btn-gold" onClick={() => chartRevealRef.current?.reveal()}>
            Generate my profile
          </button>
        </div>
      </div>

      <ChartReveal ref={chartRevealRef} />
    </section>
  );
}
