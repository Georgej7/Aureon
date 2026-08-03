"""Tarot draw is pure hash-based determinism, not true randomness -- verified
by re-deriving the same result independently (hashlib is stdlib, not this
module's own logic) rather than trusting the module against itself."""

import hashlib

from app.calc.tarot import MAJOR_ARCANA, draw_card


def test_deck_has_22_major_arcana_no_duplicates():
    assert len(MAJOR_ARCANA) == 22
    assert len(set(MAJOR_ARCANA)) == 22


def test_same_seed_always_returns_same_card():
    name1, upright1 = draw_card("user-abc:2026-07-30")
    name2, upright2 = draw_card("user-abc:2026-07-30")
    assert (name1, upright1) == (name2, upright2)


def test_different_seeds_can_return_different_cards():
    results = {draw_card(f"seed-{i}") for i in range(30)}
    # 30 distinct seeds across a 22-card x 2-orientation space (44 outcomes)
    # should not all collapse onto one result -- a weak sanity check on
    # actual variation, not a claim of perfect uniformity.
    assert len(results) > 1


def test_draw_matches_independent_hash_derivation():
    seed = "independent-check:2026-01-01"
    digest = hashlib.sha256(seed.encode("utf-8")).hexdigest()
    expected_index = int(digest[:8], 16) % len(MAJOR_ARCANA)
    expected_upright = int(digest[8], 16) % 2 == 0
    name, upright = draw_card(seed)
    assert name == MAJOR_ARCANA[expected_index]
    assert upright == expected_upright
