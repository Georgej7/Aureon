"""Numerology is pure arithmetic, so it's verified against hand/independently
computed examples rather than a "trusted chart." Each expected value below was
derived from a standalone script separate from app/calc/numerology.py before
this module existed, to avoid circularly testing the implementation against
itself (see session notes for the derivation)."""

from datetime import date

from app.calc.numerology import (
    expression_number,
    life_path_number,
    personal_year_number,
    personality_number,
    soul_urge_number,
)


def test_life_path_plain_case():
    # month=1, day=15->6, year=1990->1, sum=1+6+1=8
    assert life_path_number(date(1990, 1, 15)) == 8


def test_life_path_master_number_case():
    # month=1, day=4, year=1950->6, sum=1+4+6=11 (master, not reduced to 2)
    assert life_path_number(date(1950, 1, 4)) == 11


def test_name_numbers_plain_case():
    # JOHN SMITH: total=44->8, vowels O+I=15->6, consonants=29->11 (master)
    assert expression_number("John Smith") == 8
    assert soul_urge_number("John Smith") == 6
    assert personality_number("John Smith") == 11


def test_name_numbers_master_soul_urge_case():
    # JORDAN RIVERA (the onboarding placeholder name): total=63->9,
    # vowels O+A+I+E+A=22 (master), consonants=41->5
    assert expression_number("Jordan Rivera") == 9
    assert soul_urge_number("Jordan Rivera") == 22
    assert personality_number("Jordan Rivera") == 5


def test_personal_year():
    # birth month=3, day=14 (Jordan Rivera's onboarding placeholder DOB),
    # target year 2026: 3 + (1+4) + (2+0+2+6->1) = 3+5+1 = 9
    assert personal_year_number(date(1993, 3, 14), 2026) == 9
