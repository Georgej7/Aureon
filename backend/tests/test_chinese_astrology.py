"""Verified against well-documented reference years (not derived from this
module's own logic): 1900 is universally cited as a Metal Rat year, and 2024
is universally cited as a Wood Dragon year -- both independently checkable
public facts, not values reverse-engineered from the formula."""

from app.calc.chinese_astrology import chinese_zodiac


def test_1900_is_metal_rat():
    animal, element, yin_yang = chinese_zodiac(1900)
    assert (animal, element, yin_yang) == ("Rat", "Metal", "Yang")


def test_2024_is_wood_dragon():
    animal, element, yin_yang = chinese_zodiac(2024)
    assert (animal, element, yin_yang) == ("Dragon", "Wood", "Yang")


def test_full_60_year_sexagenary_cycle_has_no_repeats_within_cycle():
    # The animal+element+yin_yang combination should not repeat until a full
    # 60-year cycle (lcm(12, 10)) has elapsed.
    combos = [chinese_zodiac(1984 + i) for i in range(60)]
    assert len(set(combos)) == 60
    assert chinese_zodiac(1984) == chinese_zodiac(1984 + 60)


def test_1993_is_water_rooster():
    # A second independently-documented reference year, distinct from the
    # two above, cross-checking a different point in both the 12- and
    # 10-year sub-cycles.
    animal, element, yin_yang = chinese_zodiac(1993)
    assert (animal, element, yin_yang) == ("Rooster", "Water", "Yin")
