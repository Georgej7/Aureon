from app.calc.matrix_of_destiny import arcana_name, build_matrix, reduce_to_arcanum
from app.calc.tarot import MAJOR_ARCANA


def test_reduce_to_arcanum_stays_under_23_unchanged():
    assert reduce_to_arcanum(9) == 9
    assert reduce_to_arcanum(22) == 22  # exactly at the boundary, no further reduction


def test_reduce_to_arcanum_sums_digits_when_over_22():
    assert reduce_to_arcanum(25) == 7  # 2+5
    assert reduce_to_arcanum(30) == 3  # 3+0
    assert reduce_to_arcanum(1993) == 22  # 1+9+9+3 = 22, stops there


def test_reduce_to_arcanum_reduces_repeatedly_if_needed():
    # A number whose first digit-sum is still over 22 must reduce again.
    assert reduce_to_arcanum(9999) == 9  # 9+9+9+9=36, then 3+6=9


def test_arcana_name_maps_1_through_21_directly_and_22_to_the_fool():
    assert arcana_name(1) == "The Magician"
    assert arcana_name(21) == "The World"
    assert arcana_name(22) == "The Fool"
    # Every arcana name must be a real Major Arcana card, not a fabricated
    # label -- reusing MAJOR_ARCANA (already used by, and content-verified
    # for, the Tarot feature) rather than a separate hardcoded list.
    for n in range(1, 23):
        assert arcana_name(n) in MAJOR_ARCANA


def test_build_matrix_matches_hand_computed_example():
    # 1993-03-14: day=14 (already <=22, stays 14 -> Temperance, index 14).
    # month=3 (stays 3 -> The Empress, index 3).
    # year digit sum = 1+9+9+3 = 22 (stays 22 -> The Fool).
    # life purpose = reduce(14+3+22) = reduce(39) = 3+9 = 12 -> The Hanged Man, index 12.
    result = build_matrix("1993-03-14")
    assert result["day"] == {"number": 14, "arcana": "Temperance"}
    assert result["month"] == {"number": 3, "arcana": "The Empress"}
    assert result["year"] == {"number": 22, "arcana": "The Fool"}
    assert result["life_purpose"] == {"number": 12, "arcana": "The Hanged Man"}


def test_build_matrix_handles_double_digit_month_and_high_day():
    # month=12 (<=22, stays 12 -> The Hanged Man). day=31 -> reduce(31)=3+1=4 -> The Emperor.
    result = build_matrix("2000-12-31")
    assert result["month"] == {"number": 12, "arcana": "The Hanged Man"}
    assert result["day"] == {"number": 4, "arcana": "The Emperor"}
