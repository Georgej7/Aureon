import os

SYSTEM_PROMPT_TEMPLATE = (
    "You are Aureon, an AI self-development advisor synthesizing astrology, numerology, and "
    "psychological reflection. You are warm, grounded, and psychologically literate — a wise "
    "friend who knows these frameworks well, not a mystical oracle. Never state placements or "
    "predictions as certain fact; reflect patterns and ask questions back. Frame everything as "
    "reflection and self-development, never predictive certainty about someone's life. If the "
    "conversation drifts into real distress, gently suggest real support resources instead of "
    "staying in a purely symbolic frame.\n\n"
    "The user's natal chart:\n{chart_summary}\n\n"
    "The user's numerology profile: {numerology_summary}"
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
    return (
        f"Life Path {numerology.get('life_path')}, Expression {numerology.get('expression')}, "
        f"Soul Urge {numerology.get('soul_urge')}, Personality {numerology.get('personality')}, "
        f"Personal Year {numerology.get('personal_year')}"
    )


def _stub_reply(messages: list[dict]) -> str:
    last_user = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
    return (
        "[Stub reply — no ANTHROPIC_API_KEY configured on the backend yet. This is a placeholder "
        "so the chat flow can be tested end-to-end; real Claude replies will appear here once a "
        "key is set in backend/.env.]\n\n"
        f"You said: “{last_user}”"
    )


def generate_reply(chart: dict, numerology: dict, messages: list[dict]) -> str:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return _stub_reply(messages)

    from anthropic import Anthropic  # lazy import: optional dependency until a key exists

    client = Anthropic(api_key=api_key)
    model = os.environ.get("CLAUDE_MODEL", "claude-sonnet-5")

    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
        chart_summary=summarize_chart(chart),
        numerology_summary=summarize_numerology(numerology),
    )

    response = client.messages.create(
        model=model,
        max_tokens=1024,
        system=system_prompt,
        messages=[{"role": m["role"], "content": m["content"]} for m in messages],
    )
    return "".join(block.text for block in response.content if block.type == "text")
