"""Numerology is pure arithmetic, so it's verified against hand/independently
computed examples rather than a "trusted chart." Each expected value below was
derived from a standalone script separate from app/calc/numerology.py before
this module existed, to avoid circularly testing the implementation against
itself (see session notes for the derivation)."""

from datetime import date

from app.calc.numerology import (
    challenge_numbers,
    expression_number,
    karmic_debt_numbers,
    life_path_number,
    personal_year_number,
    personality_number,
    pinnacle_numbers,
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


def test_pinnacle_numbers():
    # date(1990, 1, 15): month=1, day=15->6, year=1990->1
    # P1=reduce(1+6)=7, P2=reduce(6+1)=7, P3=reduce(7+7)=reduce(14)=5, P4=reduce(1+1)=2
    assert pinnacle_numbers(date(1990, 1, 15)) == [7, 7, 5, 2]


def test_challenge_numbers():
    # same date, unreduced-master components: month=1, day=6, year=1
    # C1=|1-6|=5, C2=|6-1|=5, C3=|5-5|=0, C4=|1-1|=0
    assert challenge_numbers(date(1990, 1, 15)) == [5, 5, 0, 0]


def test_karmic_debt_none_present():
    # John Smith / date(1990, 1, 15): date-sum=1+6+1=8, name raw totals 44/15/29
    # -- none of {8, 44, 15, 29} land on 13/14/16/19
    assert karmic_debt_numbers("John Smith", date(1990, 1, 15)) == []


def test_karmic_debt_from_life_path_component():
    # Jordan Rivera's name raw totals (63/22/41) don't hit 13/14/16/19, isolating
    # the date component: date(1999, 9, 9) -> month=9, day=9, year=1999->1
    # (1+9+9+9=28->2+8=10->1+0=1), sum=9+9+1=19 -- a karmic debt hit
    assert karmic_debt_numbers("Jordan Rivera", date(1999, 9, 9)) == [19]
