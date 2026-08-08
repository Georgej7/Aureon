import os

SYSTEM_PROMPT_TEMPLATE = (
    "You are Aureon, an AI self-development advisor synthesizing astrology, numerology, and "
    "psychological reflection. You are warm, grounded, and psychologically literate — a wise "
    "friend who knows these frameworks well, not a mystical oracle. Never state placements or "
    "predictions as certain fact; reflect patterns and ask questions back. Frame everything as "
    "reflection and self-development, never predictive certainty about someone's life.\n\n"
    "If someone expresses real distress, hopelessness, self-harm or suicidal thoughts, or crisis "
    "of any kind: drop the astrology/numerology framing immediately, respond with direct human "
    "warmth (not a symbolic reading of their chart), and encourage them to reach out to real "
    "support right now. In the US, that's the 988 Suicide & Crisis Lifeline (call or text 988). "
    "Outside the US, tell them to search for their country's crisis line or contact local "
    "emergency services, since exact numbers vary by country and you should not guess one. This "
    "always takes priority over continuing the conversation as normal, even mid-topic.\n\n"
    "Ground your interpretations in the reference material below rather than general astrology/"
    "numerology knowledge — it's been reviewed for accuracy and matches this product's voice. If "
    "the reference material doesn't cover what's being asked, say so plainly rather than filling "
    "the gap with general/unreviewed knowledge — a short honest \"I don't have reviewed content on "
    "that yet\" is always better than a fabricated-sounding answer.\n\n"
    "The user's natal chart:\n{chart_summary}\n\n"
    "The user's numerology profile: {numerology_summary}\n\n"
    "Today's sky (transits) relative to this user's chart:\n{transits_summary}\n\n"
    "Reference material for this user's actual placements:\n{knowledge_summary}"
)


def summarize_chart(chart: dict) -> str:
    lines = []
    for p in chart.get("planets", []):
        retro = " (retrograde)" if p.get("retrograde") else ""
        lines.append(f"{p['name']}: {p['sign']} {p['sign_degree']:.1f}°, house {p['house']}{retro}")

    houses = chart.get("houses", [])
    ascendant_sign = houses[0]["sign"] if houses else "unknown"

    aspects = chart.get("aspects", [])
    aspect_lines = [f"{a['planet_a']} {a['aspect_type']} {a['planet_b']}" for a in aspects[:8]]

    parts = [f"Ascendant: {ascendant_sign}", "Planets:\n" + "\n".join(lines)]
    if aspect_lines:
        parts.append("Notable aspects: " + "; ".join(aspect_lines))
    return "\n".join(parts)


def summarize_numerology(numerology: dict) -> str:
    parts = [
        f"Life Path {numerology.get('life_path')}, Expression {numerology.get('expression')}, "
        f"Soul Urge {numerology.get('soul_urge')}, Personality {numerology.get('personality')}, "
        f"Personal Year {numerology.get('personal_year')}"
    ]
    pinnacles = numerology.get("pinnacles")
    if pinnacles:
        parts.append(f"Pinnacles (life-stage themes, in order): {', '.join(str(p) for p in pinnacles)}")
    challenges = numerology.get("challenges")
    if challenges:
        parts.append(f"Challenges (growth-edge themes, in order): {', '.join(str(c) for c in challenges)}")
    karmic_debts = numerology.get("karmic_debts")
    if karmic_debts:
        parts.append(f"Karmic debt numbers present: {', '.join(str(k) for k in karmic_debts)}")
    return "\n".join(parts)


def summarize_transits(transits: dict | None) -> str:
    if not transits:
        return "(not available)"

    moon_phase = transits.get("moon_phase", {})
    aspect_lines = [
        f"transiting {a['transiting_planet']} {a['aspect_type']} natal {a['natal_planet']} "
        f"(orb {a['orb']:.1f}°)"
        for a in transits.get("aspects", [])[:8]
    ]
    parts = [f"Moon phase: {moon_phase.get('name', 'unknown')}"]
    if aspect_lines:
        parts.append("Active transiting aspects: " + "; ".join(aspect_lines))
    else:
        parts.append("No major transiting aspects are currently exact.")
    return "\n".join(parts)


def summarize_knowledge(knowledge: list[dict]) -> str:
    if not knowledge:
        return "(none matched)"

    blocks = []
    for entry in knowledge:
        block = (
            f"### {entry['topic']} ({entry['category']})\n"
            f"{entry['definition']}\n"
            f"Modern take: {entry['modern_interpretation']}\n"
            f"Psychological angle: {entry['psychological_interpretation']}\n"
            f"Strengths: {entry['positive_aspects']}\n"
            f"Challenges: {entry['challenges']}\n"
            f"Growth: {entry['growth_meaning']}"
        )
        context_notes = entry.get("context_notes")
        if context_notes:
            notes = "; ".join(f"{k}: {v}" for k, v in context_notes.items())
            block += f"\nBy context: {notes}"
        blocks.append(block)
    return "\n\n".join(blocks)


def _stub_reply(messages: list[dict], knowledge: list[dict]) -> str:
    last_user = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
    topics = ", ".join(e["topic"] for e in knowledge) or "none"
    return (
        "[Stub reply — no ANTHROPIC_API_KEY configured on the backend yet. This is a placeholder "
        "so the chat flow can be tested end-to-end; real Claude replies will appear here once a "
        "key is set in backend/.env.]\n\n"
        f"You said: “{last_user}”\n"
        f"Knowledge base entries received: {topics}"
    )


def generate_reply(
    chart: dict,
    numerology: dict,
    knowledge: list[dict],
    messages: list[dict],
    transits: dict | None = None,
) -> str:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return _stub_reply(messages, knowledge)

    from anthropic import Anthropic  # lazy import: optional dependency until a key exists

    client = Anthropic(api_key=api_key)
    model = os.environ.get("CLAUDE_MODEL", "claude-sonnet-5")

    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
        chart_summary=summarize_chart(chart),
        numerology_summary=summarize_numerology(numerology),
        transits_summary=summarize_transits(transits),
        knowledge_summary=summarize_knowledge(knowledge),
    )

    response = client.messages.create(
        model=model,
        max_tokens=1024,
        system=system_prompt,
        messages=[{"role": m["role"], "content": m["content"]} for m in messages],
    )
    return "".join(block.text for block in response.content if block.type == "text")
