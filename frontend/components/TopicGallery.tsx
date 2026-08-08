"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Topic = {
  title: string;
  tag: string;
  sample: string;
  icon: React.ReactNode;
};

const TOPICS: Topic[] = [
  {
    title: "Western astrology",
    tag: "Chart · transits",
    sample:
      "Your Saturn in the 10th house has been asking for structure before speed all year. This week's transit softens that a little — a good window to actually start the thing you've been over-preparing for.",
    icon: (
      <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="#c9a24a" strokeWidth={1.3}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" />
      </svg>
    ),
  },
  {
    title: "Numerology",
    tag: "Life path · cycles",
    sample:
      "You're in a Personal Year 8 — a cycle built for consolidating, not starting fresh. Numerology reads this as your year to finish, not your year to reinvent.",
    icon: (
      <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="#c9a24a" strokeWidth={1.3}>
        <text x="4" y="17" fontSize="14" fill="#c9a24a" stroke="none" fontFamily="Fraunces, serif">
          8
        </text>
        <circle cx="12" cy="12" r="9.5" />
      </svg>
    ),
  },
  {
    title: "Matrix of destiny",
    tag: "Energy map",
    sample:
      "Your matrix shows a strong pull between independence and belonging — a tension worth naming instead of resolving too quickly. Most of your growth this decade sits right in that gap.",
    icon: (
      <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="#c9a24a" strokeWidth={1.3}>
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <line x1="4" y1="9" x2="20" y2="9" />
        <line x1="4" y1="15" x2="20" y2="15" />
        <line x1="9" y1="4" x2="9" y2="20" />
        <line x1="15" y1="4" x2="15" y2="20" />
      </svg>
    ),
  },
  {
    title: "Human design",
    tag: "Type · authority",
    sample:
      "As a Projector, your energy isn't built for constant output — it's built for recognizing where you're actually needed. Waiting for the invitation isn't passivity, it's your actual strategy.",
    icon: (
      <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="#c9a24a" strokeWidth={1.3}>
        <rect x="7" y="2" width="10" height="20" rx="5" />
        <circle cx="12" cy="7" r="1.4" fill="#c9a24a" stroke="none" />
        <circle cx="12" cy="17" r="1.4" fill="#c9a24a" stroke="none" />
      </svg>
    ),
  },
  {
    title: "Tarot",
    tag: "Daily draw",
    sample:
      "Today's draw: the Eight of Pentacles, upright. Quiet, unglamorous craftsmanship — the card of getting better at something because you actually care, not because anyone's watching.",
    icon: (
      <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="#c9a24a" strokeWidth={1.3}>
        <rect x="6" y="2" width="12" height="20" rx="2" />
        <circle cx="12" cy="9" r="2.4" />
        <line x1="9" y1="15" x2="15" y2="15" />
      </svg>
    ),
  },
  {
    title: "Moon cycles",
    tag: "Phases · timing",
    sample:
      "Full moon in four days. Notice what's been quietly building toward completion in your own timeline — not just what's loud right now.",
    icon: (
      <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="#c9a24a" strokeWidth={1.3}>
        <path d="M15 3a9 9 0 1 0 6 15.8A9 9 0 0 1 15 3Z" />
      </svg>
    ),
  },
  {
    title: "Chinese astrology",
    tag: "Zodiac · elements",
    sample:
      "As a Water Rabbit, this is traditionally a year for careful footing rather than bold moves — your instinct to double-check before committing isn't hesitation, it's the actual strategy working.",
    icon: (
      <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="#c9a24a" strokeWidth={1.3}>
        <circle cx="12" cy="12" r="9.5" />
        <path d="M12 2.5a9.5 9.5 0 0 1 0 19 4.8 4.8 0 0 1 0-9.5 4.8 4.8 0 0 0 0-9.5Z" />
        <circle cx="12" cy="7.2" r="1" fill="#14110f" stroke="none" />
        <circle cx="12" cy="16.8" r="1" fill="#c9a24a" stroke="none" />
      </svg>
    ),
  },
  {
    title: "Self-development",
    tag: "Psychology",
    sample:
      "You've mentioned wanting to set clearer boundaries at work three times this month. That's not a coincidence to note and move past — it's the actual theme asking for a decision.",
    icon: (
      <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="#c9a24a" strokeWidth={1.3}>
        <path d="M12 3a6 6 0 0 0-3 11.2V17a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2.8A6 6 0 0 0 12 3Z" />
        <line x1="10" y1="21" x2="14" y2="21" />
      </svg>
    ),
  },
];

/**
 * Topic wall: a horizontally-scrollable row of topic tiles, plus the
 * sample-reading preview modal opened by clicking a tile.
 */
export default function TopicGallery() {
  const router = useRouter();
  const [preview, setPreview] = useState<Topic | null>(null);

  return (
    <>
      <p className="eyebrow" style={{ marginTop: 70, textAlign: "center" }}>
        What Aureon reads
      </p>
      <div className="gallery-wrap">
        <div className="gallery">
          {TOPICS.map((topic) => (
            <div key={topic.title} className="tile" onClick={() => setPreview(topic)}>
              {topic.icon}
              <div>
                <p className="tname">{topic.title}</p>
                <p className="ttag">{topic.tag}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={`topic-preview${preview ? " active" : ""}`}>
        <div className="topic-preview-card hud">
          <span className="hud-tag">Sample reading</span>
          <h3>{preview?.title}</h3>
          <p>{preview?.sample}</p>
          <div className="topic-preview-actions">
            <button
              className="btn btn-gold"
              onClick={() => {
                setPreview(null);
                router.push("/chat");
              }}
            >
              Ask about this in chat
            </button>
            <button className="btn btn-ghost" onClick={() => setPreview(null)}>
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
