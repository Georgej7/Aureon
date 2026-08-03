from datetime import date

from app.calc.models import NumerologyProfile

_ROWS = ["AJS", "BKT", "CLU", "DMV", "ENW", "FOX", "GPY", "HQZ", "IR"]
LETTER_VALUES: dict[str, int] = {}
for _rank, _row in enumerate(_ROWS, start=1):
    for _ch in _row:
        LETTER_VALUES[_ch] = _rank

MASTER_NUMBERS = (11, 22, 33)


def reduce_number(n: int, keep_master: bool = True) -> int:
    while n > 9 and not (keep_master and n in MASTER_NUMBERS):
        n = sum(int(d) for d in str(n))
    return n


def _is_vowel(letters: list[str], i: int) -> bool:
    ch = letters[i]
    if ch in "AEIOU":
        return True
    if ch == "Y":
        # Y counts as a vowel unless immediately preceded by another vowel
        # (or Y itself) — the standard simplified rule used across numerology
        # calculators, since Y has no fixed vowel/consonant sound on its own.
        return i == 0 or letters[i - 1] not in "AEIOUY"
    return False


def _letters_of(name: str) -> list[str]:
    return [c for c in name.upper() if c.isalpha()]


def life_path_number(birth_date: date) -> int:
    month = reduce_number(birth_date.month)
    day = reduce_number(birth_date.day)
    year = reduce_number(birth_date.year)
    return reduce_number(month + day + year)


def expression_number(full_name: str) -> int:
    letters = _letters_of(full_name)
    return reduce_number(sum(LETTER_VALUES[c] for c in letters))


def soul_urge_number(full_name: str) -> int:
    letters = _letters_of(full_name)
    total = sum(LETTER_VALUES[c] for i, c in enumerate(letters) if _is_vowel(letters, i))
    return reduce_number(total)


def personality_number(full_name: str) -> int:
    letters = _letters_of(full_name)
    total = sum(LETTER_VALUES[c] for i, c in enumerate(letters) if not _is_vowel(letters, i))
    return reduce_number(total)


def personal_year_number(birth_date: date, target_year: int) -> int:
    month = reduce_number(birth_date.month, keep_master=False)
    day = reduce_number(birth_date.day, keep_master=False)
    year = reduce_number(target_year, keep_master=False)
    return reduce_number(month + day + year, keep_master=False)


def personal_month_number(birth_date: date, target_year: int, target_month: int) -> int:
    """Standard cascading formula: Personal Month = reduce(Personal Year +
    reduced target month). No master numbers at any step -- same convention
    as personal_year_number, which this builds on."""
    py = personal_year_number(birth_date, target_year)
    reduced_month = reduce_number(target_month, keep_master=False)
    return reduce_number(py + reduced_month, keep_master=False)


def personal_day_number(birth_date: date, target_date: date) -> int:
    """Standard cascading formula: Personal Day = reduce(Personal Month +
    reduced target day)."""
    pm = personal_month_number(birth_date, target_date.year, target_date.month)
    reduced_day = reduce_number(target_date.day, keep_master=False)
    return reduce_number(pm + reduced_day, keep_master=False)


KARMIC_DEBT_NUMBERS = (13, 14, 16, 19)


def _raw_letter_total(full_name: str, vowels_only: bool | None) -> int:
    """The un-reduced sum behind expression (vowels_only=None), soul_urge
    (True), or personality (False) — needed separately from the public
    xxx_number() functions because karmic debt detection looks at the sum
    *before* reduction, not the final single/master digit."""
    letters = _letters_of(full_name)
    if vowels_only is None:
        return sum(LETTER_VALUES[c] for c in letters)
    return sum(
        LETTER_VALUES[c] for i, c in enumerate(letters) if _is_vowel(letters, i) == vowels_only
    )


def karmic_debt_numbers(full_name: str, birth_date: date) -> list[int]:
    """Karmic debt numbers (13, 14, 16, 19) as documented by Florence Campbell
    ("Your Days Are Numbered") and Dan Millman ("The Life You Were Born to
    Live") — the two source works already cited throughout this project's
    numerology content. Detection method used here: a debt is present when
    the *first-pass* digit sum behind Life Path, Expression, Soul Urge, or
    Personality lands exactly on 13/14/16/19, before any further reduction.
    Other numerology schools use slightly different detection rules (e.g.
    checking the birth day number alone) — this is a real, documented split
    in the tradition, not a single settled standard, so treat this as one
    reputable method rather than the only correct one."""
    month, day, year = birth_date.month, birth_date.day, birth_date.year
    raw_sums = {
        reduce_number(month, keep_master=False)
        + reduce_number(day, keep_master=False)
        + reduce_number(year, keep_master=False),
        _raw_letter_total(full_name, None),
        _raw_letter_total(full_name, True),
        _raw_letter_total(full_name, False),
    }
    # A large raw sum (e.g. a long name's letter total) can pass through 13-19
    # on its way down without that being a "first-pass" landing — only count
    # sums that land there in a single digit-sum pass, same rule reduce_number
    # itself uses for one step.
    debts = set()
    for total in raw_sums:
        n = total
        while n > 99:  # bring arbitrarily large letter totals into digit-sum range first
            n = sum(int(d) for d in str(n))
        if n in KARMIC_DEBT_NUMBERS:
            debts.add(n)
    return sorted(debts)


def pinnacle_numbers(birth_date: date) -> list[int]:
    """The four Pinnacle numbers (life-stage themes), Pythagorean method:
    P1 = month+day, P2 = day+year, P3 = P1+P2, P4 = month+year — each reduced,
    master numbers kept. Exact age ranges each Pinnacle governs vary by
    source and aren't computed here; this returns the four numbers only."""
    month = reduce_number(birth_date.month)
    day = reduce_number(birth_date.day)
    year = reduce_number(birth_date.year)
    p1 = reduce_number(month + day)
    p2 = reduce_number(day + year)
    p3 = reduce_number(p1 + p2)
    p4 = reduce_number(month + year)
    return [p1, p2, p3, p4]


def challenge_numbers(birth_date: date) -> list[int]:
    """The four Challenge numbers (growth-edge themes), Pythagorean method:
    absolute differences instead of sums — C1 = |month-day|, C2 = |day-year|,
    C3 = |C1-C2|, C4 = |month-year|. Always single digits 0-8; master numbers
    don't occur here since a difference of two single digits can't exceed 8."""
    month = reduce_number(birth_date.month, keep_master=False)
    day = reduce_number(birth_date.day, keep_master=False)
    year = reduce_number(birth_date.year, keep_master=False)
    c1 = abs(month - day)
    c2 = abs(day - year)
    c3 = abs(c1 - c2)
    c4 = abs(month - year)
    return [c1, c2, c3, c4]


def build_numerology_profile(full_name: str, birth_date: date, target_year: int) -> NumerologyProfile:
    return NumerologyProfile(
        life_path=life_path_number(birth_date),
        expression=expression_number(full_name),
        soul_urge=soul_urge_number(full_name),
        personality=personality_number(full_name),
        personal_year=personal_year_number(birth_date, target_year),
        pinnacles=pinnacle_numbers(birth_date),
        challenges=challenge_numbers(birth_date),
        karmic_debts=karmic_debt_numbers(full_name, birth_date),
    )
