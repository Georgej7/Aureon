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


def build_numerology_profile(full_name: str, birth_date: date, target_year: int) -> NumerologyProfile:
    return NumerologyProfile(
        life_path=life_path_number(birth_date),
        expression=expression_number(full_name),
        soul_urge=soul_urge_number(full_name),
        personality=personality_number(full_name),
        personal_year=personal_year_number(birth_date, target_year),
    )
