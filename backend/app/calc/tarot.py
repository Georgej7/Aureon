"""Digital tarot draw -- deterministic hash-based selection from a seed string,
not true randomness with hidden state. This matches the product's own framing
(PROJECT-BRIEF.md Section 8): a tarot draw is just a shuffle, the interpretive
value comes from the writing, not from any special randomness. Deterministic
on a given seed also means a "daily card" is simple to build on top of this --
the caller passes a seed like f"{user_id}:{date}" and gets the same card back
all day, without this stateless backend needing to store anything.

MVP scope is the 22 Major Arcana only (PROJECT-BRIEF.md Section 8) -- cheaper
to source art for and interpretation-richest, not the full 78-card deck."""

import hashlib

MAJOR_ARCANA = [
    "The Fool", "The Magician", "The High Priestess", "The Empress", "The Emperor",
    "The Hierophant", "The Lovers", "The Chariot", "Strength", "The Hermit",
    "Wheel of Fortune", "Justice", "The Hanged Man", "Death", "Temperance",
    "The Devil", "The Tower", "The Star", "The Moon", "The Sun",
    "Judgement", "The World",
]


def draw_card(seed: str) -> tuple[str, bool]:
    """Returns (card_name, upright). Same seed always returns the same card --
    determinism is the point, not a limitation, per the module docstring."""
    digest = hashlib.sha256(seed.encode("utf-8")).hexdigest()
    index = int(digest[:8], 16) % len(MAJOR_ARCANA)
    upright = int(digest[8], 16) % 2 == 0
    return MAJOR_ARCANA[index], upright
