"""Personal Kua number (feng shui's core personal-direction system) — pure
arithmetic on birth year and gender, verified against published reference
sources before implementation rather than derived from memory alone (see
session notes). No ephemeris involved; this is numerology-adjacent, not
astronomical.

Known simplification: the traditional calculation uses the Chinese lunar
new year as the year boundary, so a birth date in January or early February
technically belongs to the previous lunar year. This implementation uses the
Gregorian calendar year as given, which is accurate for the vast majority of
the year and the common simplified form of this calculator — flagged here
rather than silently wrong."""

Gender = str  # "male" | "female" — kept as a plain str to avoid a Literal import for one use


def _digit_sum_reduce(n: int) -> int:
    while n > 9:
        n = sum(int(d) for d in str(n))
    return n


def kua_number(birth_year: int, gender: Gender) -> int:
    last_two = birth_year % 100
    x = _digit_sum_reduce(last_two // 10 + last_two % 10)
    if birth_year >= 2000:
        raw = (9 - x) if gender == "male" else _digit_sum_reduce(x + 6)
    else:
        raw = _digit_sum_reduce(10 - x) if gender == "male" else _digit_sum_reduce(x + 5)

    if raw == 0:
        raw = 9
    if raw == 5:
        raw = 2 if gender == "male" else 8
    return raw


# (group, element, sheng_chi, tien_yi, nien_yen, fu_wei) per Kua number.
# Directions verified against published feng shui reference tables — kua 5
# has no entry since it's always substituted to 2 (male) or 8 (female) above.
KUA_DATA: dict[int, dict[str, str]] = {
    1: {"group": "East", "element": "Water", "sheng_chi": "Southeast", "tien_yi": "East", "nien_yen": "South", "fu_wei": "North"},
    2: {"group": "West", "element": "Earth", "sheng_chi": "Northeast", "tien_yi": "West", "nien_yen": "Northwest", "fu_wei": "Southwest"},
    3: {"group": "East", "element": "Wood", "sheng_chi": "South", "tien_yi": "North", "nien_yen": "Southeast", "fu_wei": "East"},
    4: {"group": "East", "element": "Wood", "sheng_chi": "North", "tien_yi": "South", "nien_yen": "East", "fu_wei": "Southeast"},
    6: {"group": "West", "element": "Metal", "sheng_chi": "West", "tien_yi": "Northeast", "nien_yen": "Southwest", "fu_wei": "Northwest"},
    7: {"group": "West", "element": "Metal", "sheng_chi": "Northwest", "tien_yi": "Southwest", "nien_yen": "Northeast", "fu_wei": "West"},
    8: {"group": "West", "element": "Earth", "sheng_chi": "Southwest", "tien_yi": "Northwest", "nien_yen": "West", "fu_wei": "Northeast"},
    9: {"group": "East", "element": "Fire", "sheng_chi": "East", "tien_yi": "Southeast", "nien_yen": "North", "fu_wei": "South"},
}
