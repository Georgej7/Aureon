import type { KnowledgeEntry } from "@/lib/api";

/**
 * Every knowledge_base entry is authored with 8 distinct interpretive
 * angles, not just `definition` — this surfaces all of them instead of the
 * single-paragraph summary every content-driven page previously showed.
 */
export default function KnowledgeDetail({ entry }: { entry: KnowledgeEntry }) {
  const sections: { label: string; text: string }[] = [
    { label: "Traditional view", text: entry.traditional_interpretation },
    { label: "Modern view", text: entry.modern_interpretation },
    { label: "Psychological angle", text: entry.psychological_interpretation },
    { label: "Strengths", text: entry.positive_aspects },
    { label: "Challenges", text: entry.challenges },
    { label: "Career", text: entry.career_meaning },
    { label: "Relationships", text: entry.relationship_meaning },
    { label: "Growth", text: entry.growth_meaning },
  ].filter((s) => !!s.text);

  return (
    <>
      {sections.map((s) => (
        <div key={s.label} style={{ margin: "0 0 16px" }}>
          <div
            style={{
              fontSize: 11,
              color: "var(--gold-soft)",
              letterSpacing: 1,
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            {s.label}
          </div>
          <p style={{ margin: 0 }}>{s.text}</p>
        </div>
      ))}
    </>
  );
}
