import Link from "next/link";
import LandingGate from "@/components/LandingGate";
import TopicGallery from "@/components/TopicGallery";

export default function LandingPage() {
  return (
    <LandingGate>
      <section className="screen active" id="landing">
        <div className="hero hero-solo">
          <div>
            <p className="eyebrow rise rise-1">An orbit, not a horoscope</p>
            <h1 className="rise rise-2">
              The sky keeps moving.
              <br />
              So do you.
              <br />
              Aureon is what keeps track.
            </h1>
            <p className="lede rise rise-3">
              Most astrology apps hand you today&apos;s forecast and forget you by tomorrow. Aureon
              holds your whole chart, your numbers, your questions from three months ago — and
              talks to you like it was actually paying attention.
            </p>
            <div className="cta-row rise rise-4">
              <Link className="btn btn-gold" href="/onboarding">
                Create your profile
              </Link>
              <Link className="btn btn-ghost" href="/chat">
                See a sample reading
              </Link>
            </div>
          </div>
        </div>

        <div className="orbit-card hud rise rise-3 synthesis-banner">
          <span className="hud-tag">Live synthesis</span>
          <div className="synthesis-row">
            <svg className="constellation-inline" viewBox="0 0 180 180">
              <g stroke="#c9a24a" strokeWidth={0.6} opacity={0.6}>
                <line x1="20" y1="30" x2="70" y2="60" />
                <line x1="70" y1="60" x2="130" y2="40" />
                <line x1="70" y1="60" x2="90" y2="120" />
              </g>
              <circle cx="20" cy="30" r="2" fill="#c9a24a" />
              <circle cx="70" cy="60" r="2.4" fill="#c9a24a" />
              <circle cx="130" cy="40" r="2" fill="#c9a24a" />
              <circle cx="90" cy="120" r="2" fill="#c9a24a" />
            </svg>
            <div>
              <p className="tag">This week&apos;s synthesis</p>
              <h3>Saturn meets your Life Path 8</h3>
              <p>
                Your chart&apos;s push toward long-term structure lines up with a numerology cycle
                that rewards patience over speed this month — worth sitting with before you make the
                career call you mentioned last week.
              </p>
            </div>
          </div>
        </div>

        <div className="feature-grid">
          <div className="feature">
            <div className="num">01</div>
            <h4>Cross-system reading</h4>
            <p>Astrology and numerology synthesized into one coherent answer, not two separate reports.</p>
          </div>
          <div className="feature">
            <div className="num">02</div>
            <h4>Real memory</h4>
            <p>Remembers your goals, past questions, and life events across months, not just this session.</p>
          </div>
          <div className="feature">
            <div className="num">03</div>
            <h4>Grounded, not certain</h4>
            <p>Framed as reflection and self-development — never predictive claims about your life.</p>
          </div>
          <div className="feature">
            <div className="num">04</div>
            <h4>Precise placements</h4>
            <p>Charts computed from real astronomical data, interpreted by AI — not generated from scratch.</p>
          </div>
        </div>

        <TopicGallery />
      </section>
    </LandingGate>
  );
}
