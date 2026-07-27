"""Verifies the Kua number formula against published feng shui reference
sources (cross-checked via live web search before implementation, not
derived from memory alone -- see session notes), plus the edge-case
substitution rules and direction-table completeness."""

import pytest

from app.calc.bagua import BAGUA_GRID, COMPASS, bagua_zones
from app.calc.feng_shui import KUA_DATA, kua_number

EAST_GROUP = {1, 3, 4, 9}
WEST_GROUP = {2, 6, 7, 8}


def test_pre_2000_male_formula():
    # 1977: last two digits 7+7=14 -> 1+4=5; male pre-2000: 10-5=5 -> 5 substitutes to 2
    assert kua_number(1977, "male") == 2


def test_pre_2000_female_formula():
    # 1977: X=5; female pre-2000: 5+5=10 -> 1+0=1
    assert kua_number(1977, "female") == 1


def test_post_2000_male_formula():
    # 2005: 0+5=5; male post-2000: 9-5=4
    assert kua_number(2005, "male") == 4


def test_post_2000_female_formula():
    # 2005: X=5; female post-2000: 5+6=11 -> 1+1=2
    assert kua_number(2005, "female") == 2


def test_zero_result_substitutes_to_nine():
    # 2009: 0+9=9; male post-2000: 9-9=0 -> substitutes to 9
    assert kua_number(2009, "male") == 9


def _reduce(n: int) -> int:
    while n > 9:
        n = sum(int(d) for d in str(n))
    return n


def test_male_five_result_substitutes_to_two():
    # Male and female hit their own raw-5 case at different birth years
    # (the two formulas are independent, not mirror images at the same X) --
    # searched separately rather than assumed to coincide.
    for year in range(1900, 2100):
        last_two = year % 100
        x = _reduce(last_two // 10 + last_two % 10)
        raw_male = _reduce(9 - x) if year >= 2000 else _reduce(10 - x)
        if raw_male == 5:
            assert kua_number(year, "male") == 2
            return
    pytest.fail("no year in range produced a raw male Kua 5 -- test setup is wrong")


def test_female_five_result_substitutes_to_eight():
    for year in range(1900, 2100):
        last_two = year % 100
        x = _reduce(last_two // 10 + last_two % 10)
        raw_female = _reduce(x + 6) if year >= 2000 else _reduce(x + 5)
        if raw_female == 5:
            assert kua_number(year, "female") == 8
            return
    pytest.fail("no year in range produced a raw female Kua 5 -- test setup is wrong")


def test_all_results_are_valid_kua_numbers():
    valid = set(KUA_DATA.keys())
    for year in range(1900, 2100):
        for gender in ("male", "female"):
            assert kua_number(year, gender) in valid


def test_direction_table_complete_and_grouped_correctly():
    assert set(KUA_DATA.keys()) == {1, 2, 3, 4, 6, 7, 8, 9}
    for kua, data in KUA_DATA.items():
        if kua in EAST_GROUP:
            assert data["group"] == "East"
        if kua in WEST_GROUP:
            assert data["group"] == "West"
        directions = {data["sheng_chi"], data["tien_yi"], data["nien_yen"], data["fu_wei"]}
        assert len(directions) == 4  # all four directions distinct, none omitted


def test_kua_one_directions_match_published_reference():
    # Spot check against a published table (fengshuinexus.com), not just
    # internal consistency.
    assert KUA_DATA[1] == {
        "group": "East", "element": "Water",
        "sheng_chi": "Southeast", "tien_yi": "East", "nien_yen": "South", "fu_wei": "North",
    }


def test_kua_eight_directions_match_published_reference():
    assert KUA_DATA[8] == {
        "group": "West", "element": "Earth",
        "sheng_chi": "Southwest", "tien_yi": "Northwest", "nien_yen": "West", "fu_wei": "Northeast",
    }


# ---- Bagua (BTB) grid ----

def test_bagua_grid_has_nine_positions_matching_published_layout():
    # Verified identically against two independent published sources
    # (lawoffengshui.com, easternsage.com) before implementation.
    assert BAGUA_GRID["top_left"]["zone"] == "Wealth & Fortune"
    assert BAGUA_GRID["top_center"]["zone"] == "Fame & Reputation"
    assert BAGUA_GRID["top_right"]["zone"] == "Love & Relationships"
    assert BAGUA_GRID["middle_left"]["zone"] == "Family"
    assert BAGUA_GRID["center"]["zone"] == "Health & Well-Being"
    assert BAGUA_GRID["middle_right"]["zone"] == "Children & Creativity"
    assert BAGUA_GRID["bottom_left"]["zone"] == "Knowledge & Wisdom"
    assert BAGUA_GRID["bottom_center"]["zone"] == "Career & Life Path"
    assert BAGUA_GRID["bottom_right"]["zone"] == "Helpful People & Travel"


def test_bagua_facing_north_matches_hand_verified_directions():
    # Hand-derived via top-down floor-plan reasoning before writing the
    # implementation (see session notes) -- this is the case that reasoning
    # was checked against, not just re-deriving the same formula.
    zones = {z["position"]: z["direction"] for z in bagua_zones("N")}
    assert zones == {
        "top_left": "NW", "top_center": "N", "top_right": "NE",
        "middle_left": "W", "center": None, "middle_right": "E",
        "bottom_left": "SW", "bottom_center": "S", "bottom_right": "SE",
    }


def test_bagua_entrance_wall_is_always_career_row_regardless_of_facing():
    # The defining BTB rule: bottom row (nearest the entrance) is always
    # Knowledge/Career/Helpful People -- true independent of which way the
    # entrance actually points, since BTB doesn't rotate the grid itself,
    # only the compass-direction overlay this implementation adds on top.
    for direction in COMPASS:
        zones = {z["position"]: z["zone"] for z in bagua_zones(direction)}
        assert zones["bottom_left"] == "Knowledge & Wisdom"
        assert zones["bottom_center"] == "Career & Life Path"
        assert zones["bottom_right"] == "Helpful People & Travel"


def test_bagua_opposite_zones_are_always_180_degrees_apart():
    for direction in COMPASS:
        zones = {z["position"]: z["direction"] for z in bagua_zones(direction)}
        pairs = [
            ("top_left", "bottom_right"),
            ("top_center", "bottom_center"),
            ("top_right", "bottom_left"),
        ]
        for a, b in pairs:
            idx_a = COMPASS.index(zones[a])
            idx_b = COMPASS.index(zones[b])
            assert (idx_a - idx_b) % 8 == 4  # 4 steps of 45deg = 180deg apart


def test_bagua_center_has_no_direction():
    for direction in COMPASS:
        zones = {z["position"]: z["direction"] for z in bagua_zones(direction)}
        assert zones["center"] is None
