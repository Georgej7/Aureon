"""Matrix of Destiny -- a modern numerology-based system (not an ancient or
astronomically-verifiable tradition the way the rest of this codebase's calc
engine is) that maps a birth date onto 22 archetypal numbers, explicitly
borrowed from Tarot's 22 Major Arcana -- many schools of this tradition use
that exact numbering/imagery convention directly, which is why this module
reuses tarot.py's MAJOR_ARCANA list rather than inventing separate meanings.

Scoped deliberately to the well-agreed-upon CORE calculation (Day/Month/Year
arcana plus their combined Life Purpose arcana) rather than the fuller
expanded matrix some schools compute (money, talents, karmic tail,
ancestral lines, etc.). Those derived points' exact formulas and position
meanings genuinely vary between schools/practitioners in a way this
project's usual "verified against real astronomy" or "cross-checked against
multiple independent published sources" bar doesn't cleanly apply to --
rather than pick one school's specific convention and present it with the
same confidence as everything else in this app, this stays to the part
that's actually consistent across sources.
"""

from app.calc.tarot import MAJOR_ARCANA


def reduce_to_arcanum(n: int) -> int:
    """Sums digits repeatedly until the result is 22 or under -- Matrix of
    Destiny's own reduction target (1-22, matching the 22 Major Arcana),
    distinct from standard Pythagorean numerology's reduction to
    1-9/11/22/33 (see app/calc/numerology.py)."""
    while n > 22:
        n = sum(int(d) for d in str(n))
    return n


def arcana_name(n: int) -> str:
    """Arcana 1-21 map directly onto MAJOR_ARCANA's Magician..World (indices
    1-21); 22 maps to The Fool (index 0) -- the standard convention used by
    schools that shift the Fool from its usual 0 to 22 rather than leave a
    0 case the reduction never actually produces."""
    return MAJOR_ARCANA[n % 22]


def build_matrix(birth_date: str) -> dict:
    """birth_date: "YYYY-MM-DD". Returns the four core points -- Day, Month,
    Year (each independently reduced), and Life Purpose (their sum,
    reduced again)."""
    year, month, day = (int(part) for part in birth_date.split("-"))
    day_point = reduce_to_arcanum(day)
    month_point = reduce_to_arcanum(month)
    year_point = reduce_to_arcanum(sum(int(d) for d in str(year)))
    life_purpose_point = reduce_to_arcanum(day_point + month_point + year_point)
    return {
        "day": {"number": day_point, "arcana": arcana_name(day_point)},
        "month": {"number": month_point, "arcana": arcana_name(month_point)},
        "year": {"number": year_point, "arcana": arcana_name(year_point)},
        "life_purpose": {"number": life_purpose_point, "arcana": arcana_name(life_purpose_point)},
    }
