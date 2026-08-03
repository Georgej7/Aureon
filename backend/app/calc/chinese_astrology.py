"""Chinese zodiac (animal sign + element) -- pure arithmetic on birth year,
using the standard sexagenary-cycle formula (stem = (year-4) % 10, branch =
(year-4) % 12), verified against known reference years before implementation
(1900 = Metal Rat, 2024 = Wood Dragon -- see tests) rather than derived from
memory alone.

Known simplification, same caveat as app/calc/feng_shui.py's Kua number:
the traditional boundary is the Chinese lunar new year (falls between Jan 21
and Feb 20), not January 1st -- a birth date in that window technically
belongs to the previous zodiac year. This implementation uses the Gregorian
calendar year as given, the common simplified form of this calculator,
flagged here rather than silently wrong."""

ANIMALS = [
    "Rat", "Ox", "Tiger", "Rabbit", "Dragon", "Snake",
    "Horse", "Goat", "Monkey", "Rooster", "Dog", "Pig",
]

ELEMENTS = ["Wood", "Fire", "Earth", "Metal", "Water"]


def chinese_zodiac(birth_year: int) -> tuple[str, str, str]:
    """Returns (animal, element, yin_yang) for a Gregorian birth year."""
    branch_index = (birth_year - 4) % 12
    stem_index = (birth_year - 4) % 10
    animal = ANIMALS[branch_index]
    element = ELEMENTS[stem_index // 2]
    yin_yang = "Yang" if stem_index % 2 == 0 else "Yin"
    return animal, element, yin_yang
