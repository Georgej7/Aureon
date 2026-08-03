"""Verifies the Vedic (sidereal) additions: the ayanamsa correction is
self-consistent with Swiss Ephemeris's own reported value (same equinox
timestamps already verified in test_astrology.py's tropical tests), nakshatra
boundaries land where the fixed 13d20m spans say they should, Rahu/Ketu stay
exactly opposite each other, and the Vimshottari dasha sequence/durations
match the fixed traditional table -- all pure arithmetic, independently
checkable without trusting the engine's own output."""

from datetime import datetime, timedelta, timezone

import swisseph as swe

from app.calc.astrology import build_vedic_chart
from app.calc.ephemeris import planet_longitudes, sidereal_longitudes, to_julian_day
from app.calc.models import BirthData
from app.calc.vedic import (
    DASHA_SEQUENCE,
    DASHA_YEARS,
    NAKSHATRA_SPAN,
    current_mahadasha,
    detect_house_lordship_yogas,
    detect_vedic_yogas,
    house_lord,
    nakshatra_for_longitude,
    navamsa_sign,
)

EQUINOX_SOLSTICE_CASES = [
    ("march equinox 2024", "2024-03-20T03:06:00+00:00"),
    ("june solstice 2024", "2024-06-20T20:51:00+00:00"),
    ("september equinox 2024", "2024-09-22T12:44:00+00:00"),
    ("december solstice 2024", "2024-12-21T09:20:00+00:00"),
]


def test_sidereal_offset_matches_swisseph_own_ayanamsa():
    for label, iso_dt in EQUINOX_SOLSTICE_CASES:
        jd = to_julian_day(iso_dt)
        tropical, _retro = planet_longitudes(jd)["Sun"]
        sidereal, _retro2 = sidereal_longitudes(jd)["Sun"]
        offset = (tropical - sidereal) % 360
        expected_ayanamsa = swe.get_ayanamsa_ut(jd)
        assert abs(offset - expected_ayanamsa) < 0.01, f"{label}: offset {offset} vs ayanamsa {expected_ayanamsa}"


def test_nakshatra_boundaries():
    assert nakshatra_for_longitude(0.0) == ("Ashwini", "Ketu", 0.0)
    name, lord, fraction = nakshatra_for_longitude(NAKSHATRA_SPAN / 2)
    assert (name, lord) == ("Ashwini", "Ketu")
    assert abs(fraction - 0.5) < 1e-6
    name2, lord2, fraction2 = nakshatra_for_longitude(NAKSHATRA_SPAN)
    assert (name2, lord2) == ("Bharani", "Venus")
    assert fraction2 < 1e-6
    # last nakshatra (Revati) ends the 27-cycle just before 360
    name3, lord3, _f = nakshatra_for_longitude(359.9)
    assert (name3, lord3) == ("Revati", "Mercury")


def test_rahu_ketu_always_opposite():
    birth = BirthData(datetime="1993-03-14T04:12:00-05:00", latitude=40.7, longitude=-74.0)
    chart = build_vedic_chart(birth)
    rahu = next(p for p in chart.planets if p.name == "Rahu")
    ketu = next(p for p in chart.planets if p.name == "Ketu")
    diff = abs(rahu.longitude - ketu.longitude) % 360
    assert abs(diff - 180) < 1e-6
    assert rahu.retrograde == ketu.retrograde


def test_dasha_sequence_covers_120_years_with_correct_order():
    assert sum(DASHA_YEARS[p] for p in DASHA_SEQUENCE) == 120
    assert DASHA_SEQUENCE == ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"]


def test_dasha_first_period_is_full_duration_when_moon_at_nakshatra_start():
    birth_dt = datetime(1990, 1, 1, tzinfo=timezone.utc)
    # Moon at exactly 0 deg -> Ashwini -> Ketu lord, elapsed_fraction 0 ->
    # first Mahadasha should run the full 7 years, no partial shortening.
    just_before_end = birth_dt + timedelta(days=7 * 365.25 - 1)
    result = current_mahadasha(0.0, birth_dt, just_before_end)
    assert result["lord"] == "Ketu"

    just_after_end = birth_dt + timedelta(days=7 * 365.25 + 1)
    result2 = current_mahadasha(0.0, birth_dt, just_after_end)
    assert result2["lord"] == "Venus"  # next in DASHA_SEQUENCE after Ketu


def test_dasha_partial_first_period_when_moon_mid_nakshatra():
    birth_dt = datetime(1990, 1, 1, tzinfo=timezone.utc)
    # Moon halfway through Ashwini (Ketu, 7yr) -> only ~3.5 years of the
    # first period should remain from birth.
    halfway_longitude = NAKSHATRA_SPAN / 2
    just_before = birth_dt + timedelta(days=3.5 * 365.25 - 5)
    just_after = birth_dt + timedelta(days=3.5 * 365.25 + 5)
    assert current_mahadasha(halfway_longitude, birth_dt, just_before)["lord"] == "Ketu"
    assert current_mahadasha(halfway_longitude, birth_dt, just_after)["lord"] == "Venus"


def test_whole_sign_houses_ascendant_sign_is_always_house_one():
    birth = BirthData(datetime="1993-03-14T04:12:00-05:00", latitude=40.7, longitude=-74.0)
    chart = build_vedic_chart(birth)
    asc_sign = chart.ascendant_sign
    for planet in chart.planets:
        if planet.sign == asc_sign:
            assert planet.house == 1


def test_vedic_chart_without_location_has_no_ascendant_but_has_dasha_and_nakshatra():
    birth = BirthData(datetime="1993-03-14T04:12:00-05:00")
    chart = build_vedic_chart(birth)
    assert chart.ascendant is None
    assert chart.ascendant_sign is None
    assert chart.ascendant_nakshatra is None
    assert chart.moon_nakshatra is not None
    assert chart.current_mahadasha is not None
    assert all(p.house is None for p in chart.planets)


def test_navamsa_sign_boundaries():
    # Movable signs (Aries, Cancer, Libra, Capricorn) start their own navamsa
    # count from themselves -- pada 1 of a movable sign stays that sign.
    assert navamsa_sign(0.0) == "Aries"
    assert navamsa_sign(90.0) == "Cancer"
    # Fixed signs (Taurus, Leo, Scorpio, Aquarius) start counting from the 9th
    # sign ahead -- pada 1 of Taurus (0-30deg) is Capricorn (Taurus=1st,
    # Gemini=2nd, ... Capricorn=9th).
    assert navamsa_sign(30.0) == "Capricorn"
    # Dual/mutable signs (Gemini, Virgo, Sagittarius, Pisces) start counting
    # from the 5th sign ahead -- pada 1 of Gemini (60-90deg) is Libra
    # (Gemini=1st, Cancer=2nd, Leo=3rd, Virgo=4th, Libra=5th).
    assert navamsa_sign(60.0) == "Libra"


def test_gaja_kesari_yoga_detected_in_kendra_from_moon():
    # Moon at 10deg (Aries, sign 0), Jupiter at 100deg (Cancer, sign 3) --
    # 3 signs apart, a kendra relationship (Brihat Parashara Hora Shastra def).
    raw = {"Moon": (10.0, False), "Jupiter": (100.0, False)}
    yogas = detect_vedic_yogas(raw)
    assert ("Gaja Kesari Yoga", ["Moon", "Jupiter"]) in yogas


def test_gaja_kesari_yoga_absent_when_not_kendra():
    # Moon in Aries (sign 0), Jupiter in Taurus (sign 1) -- 1 sign apart, not a kendra.
    raw = {"Moon": (10.0, False), "Jupiter": (40.0, False)}
    yogas = detect_vedic_yogas(raw)
    assert not any(y[0] == "Gaja Kesari Yoga" for y in yogas)


def test_chandra_mangal_yoga_same_sign():
    raw = {"Moon": (15.0, False), "Mars": (20.0, False)}  # both Aries
    yogas = detect_vedic_yogas(raw)
    assert ("Chandra-Mangal Yoga", ["Moon", "Mars"]) in yogas


def test_budhaditya_yoga_same_sign():
    raw = {"Sun": (100.0, False), "Mercury": (105.0, False)}  # both Cancer
    yogas = detect_vedic_yogas(raw)
    assert ("Budhaditya Yoga", ["Sun", "Mercury"]) in yogas


def test_house_lord_aries_ascendant_matches_traditional_rulerships():
    # Aries ascendant (index 0): house N is the Nth sign in order.
    assert house_lord(1, 0) == "Mars"  # Aries
    assert house_lord(2, 0) == "Venus"  # Taurus
    assert house_lord(10, 0) == "Saturn"  # Capricorn


def test_raj_yoga_karaka_cancer_ascendant_mars_classic_case():
    # Textbook example: for Cancer ascendant, Mars rules both the 10th house
    # (Aries) and the 5th house (Scorpio) -- a kendra and a trikona -- making
    # Mars a yogakaraka on lordship alone, independent of where any planet
    # actually sits (hence the empty sign_of dict).
    yogas = detect_house_lordship_yogas({}, ascendant_sign_index=3)
    assert ("Raj Yoga", ["Mars"]) in yogas


def test_raj_yoga_absent_for_aries_ascendant_with_no_connection():
    # Aries ascendant: kendra lords {Mars, Moon, Venus, Saturn}, trikona
    # lords {Mars, Sun, Jupiter} (excluding the shared house-1/Mars overlap,
    # which is correctly skipped, not counted as a yoga). With no planets
    # placed to create a conjunction/exchange, no Raj Yoga should fire.
    yogas = detect_house_lordship_yogas({}, ascendant_sign_index=0)
    assert not any(y[0] == "Raj Yoga" for y in yogas)


def test_dhana_yoga_conjunction_aries_ascendant():
    # Aries ascendant: 2nd lord Venus (Taurus), 11th lord Saturn (Aquarius).
    # Placing both in the same sign (Virgo, index 5) should trigger Dhana Yoga.
    sign_of = {"Venus": 5, "Saturn": 5}
    yogas = detect_house_lordship_yogas(sign_of, ascendant_sign_index=0)
    assert ("Dhana Yoga", ["Saturn", "Venus"]) in yogas


def test_dhana_yoga_absent_without_connection():
    sign_of = {"Venus": 5, "Saturn": 8}  # different signs, no exchange either
    yogas = detect_house_lordship_yogas(sign_of, ascendant_sign_index=0)
    assert not any(y[0] == "Dhana Yoga" for y in yogas)


def test_detect_vedic_yogas_includes_house_lordship_yogas_when_ascendant_known():
    yogas = detect_vedic_yogas({}, ascendant_sign_index=3)
    assert ("Raj Yoga", ["Mars"]) in yogas


def test_detect_vedic_yogas_skips_house_lordship_yogas_without_ascendant():
    yogas = detect_vedic_yogas({})
    assert not any(y[0] in ("Raj Yoga", "Dhana Yoga") for y in yogas)
