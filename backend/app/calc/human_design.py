"""Human Design chart calculation.

Reference data (gate wheel order, gate-to-center assignments, the 36
channels) was cross-verified against multiple independent published sources
before being hardcoded here -- see session notes for the specific sources
and cross-checks. This is not ancient/ephemeris-verifiable data the way
equinox timestamps are; it's Ra Uru Hu's specific system, so "verified"
here means "multiple independent secondary sources agree," not
independently re-derived from first principles.

Two charts are combined: Personality (planetary positions at the actual
birth moment) and Design (planetary positions 88 degrees of solar arc
*before* birth -- not a fixed number of calendar days, since the Sun's
apparent speed varies slightly through the year)."""

from datetime import datetime, timezone

import swisseph as swe

from app.calc import ephemeris

GATE_WIDTH = 360 / 64  # 5.625 degrees per gate
LINE_WIDTH = GATE_WIDTH / 6  # 0.9375 degrees per line

# The longitude where Gate 25 begins (358d15' -- i.e. 28d15' into Pisces),
# cross-verified against 3 independent published gate-degree tables. Gate
# order below follows immediately from this anchor point at fixed 5.625deg
# steps, in the confirmed wheel sequence (NOT numerical gate order -- Gate 1
# and Gate 2 are not adjacent on the wheel).
GATE_25_START = 358 + 15 / 60

GATE_ORDER = [
    25, 17, 21, 51, 42, 3, 27, 24, 2, 23, 8, 20, 16, 35, 45, 12,
    15, 52, 39, 53, 62, 56, 31, 33, 7, 4, 29, 59, 40, 64, 47, 6,
    46, 18, 48, 57, 32, 50, 28, 44, 1, 43, 14, 34, 9, 5, 26, 11,
    10, 58, 38, 54, 61, 60, 41, 19, 13, 49, 30, 55, 37, 63, 22, 36,
]

CENTERS = {
    "Head": [61, 63, 64],
    "Ajna": [4, 11, 17, 24, 43, 47],
    "Throat": [8, 12, 16, 20, 23, 31, 33, 35, 45, 56, 62],
    "G": [1, 2, 7, 10, 13, 15, 25, 46],
    "Heart": [21, 26, 40, 51],
    "Spleen": [18, 28, 32, 44, 48, 50, 57],
    "Sacral": [3, 5, 9, 14, 27, 29, 34, 42, 59],
    "SolarPlexus": [6, 22, 30, 36, 37, 49, 55],
    "Root": [19, 38, 39, 41, 52, 53, 54, 58, 60],
}

GATE_TO_CENTER = {gate: center for center, gates in CENTERS.items() for gate in gates}

MOTOR_CENTERS = {"Sacral", "Heart", "SolarPlexus", "Root"}

# Traditional channel names -- these are the widely-published names used
# consistently across the Human Design community (same epistemic status as
# the gate wheel/channel list above: not independently re-derivable the way
# an equinox timestamp is, multiple published sources agree on these names).
# Some channels are known by more than one common name; picked the most
# widely-used one rather than trying to list every variant.
CHANNEL_NAMES: dict[tuple[int, int], str] = {
    (1, 8): "Channel of Inspiration",
    (2, 14): "Channel of the Beat",
    (3, 60): "Channel of Mutation",
    (4, 63): "Channel of Logic",
    (5, 15): "Channel of Rhythm",
    (6, 59): "Channel of Mating",
    (7, 31): "Channel of the Alpha",
    (9, 52): "Channel of Concentration",
    (10, 20): "Channel of Awakening",
    (10, 34): "Channel of Exploration",
    (10, 57): "Channel of Perfected Form",
    (11, 56): "Channel of Curiosity",
    (12, 22): "Channel of Openness",
    (13, 33): "Channel of the Prodigal",
    (16, 48): "Channel of the Wavelength",
    (17, 62): "Channel of Acceptance",
    (18, 58): "Channel of Judgment",
    (19, 49): "Channel of Synthesis",
    (20, 34): "Channel of Charisma",
    (20, 57): "Channel of the Brainwave",
    (21, 45): "Channel of Money",
    (23, 43): "Channel of Structuring",
    (24, 61): "Channel of Awareness",
    (25, 51): "Channel of Initiation",
    (26, 44): "Channel of Surrender",
    (27, 50): "Channel of Preservation",
    (28, 38): "Channel of Struggle",
    (29, 46): "Channel of Discovery",
    (30, 41): "Channel of Recognition",
    (32, 54): "Channel of Transformation",
    (34, 57): "Channel of Power",
    (35, 36): "Channel of Transitoriness",
    (37, 40): "Channel of Community",
    (39, 55): "Channel of Emoting",
    (42, 53): "Channel of Maturation",
    (47, 64): "Channel of Abstraction",
}

# The 36 channels, cross-verified against 2 independent published lists
# (normalized/sorted pairs matched exactly between them).
CHANNELS = [
    (1, 8), (2, 14), (3, 60), (4, 63), (5, 15), (6, 59), (7, 31), (9, 52),
    (10, 20), (10, 34), (10, 57), (11, 56), (12, 22), (13, 33), (16, 48),
    (17, 62), (18, 58), (19, 49), (20, 34), (20, 57), (21, 45), (23, 43),
    (24, 61), (25, 51), (26, 44), (27, 50), (28, 38), (29, 46), (30, 41),
    (32, 54), (34, 57), (35, 36), (37, 40), (39, 55), (42, 53), (47, 64),
]

# Authority check order -- higher in the list wins if its center is defined.
# Sourced from multiple independent guides; Environmental/Lunar are the
# fallbacks for certain Projectors and all Reflectors respectively.
AUTHORITY_ORDER = [
    ("SolarPlexus", "Emotional Authority"),
    ("Sacral", "Sacral Authority"),
    ("Spleen", "Splenic Authority"),
    ("Heart", "Ego Authority"),
    ("G", "Self-Projected Authority"),
]


def gate_and_line(longitude: float) -> tuple[int, int]:
    """Which of the 64 gates (and which of its 6 lines) a tropical longitude
    falls in, per the wheel order anchored at GATE_25_START above."""
    normalized = (longitude - GATE_25_START) % 360
    gate_index = int(normalized // GATE_WIDTH)
    gate = GATE_ORDER[gate_index]
    position_in_gate = normalized - gate_index * GATE_WIDTH
    line = int(position_in_gate // LINE_WIDTH) + 1
    return gate, line


def find_design_julian_day(birth_jd: float, birth_sun_longitude: float) -> float:
    """Binary search backward from birth for the moment the Sun was exactly
    88 degrees of arc earlier -- not birth_jd minus a fixed day count, since
    the Sun's apparent speed varies through the year (~0.95-1.02 deg/day).
    The Sun moves monotonically forward in longitude, so within a ~12-day
    window around 88 degrees back, its longitude crosses the target exactly
    once -- safe for plain bisection, no wraparound edge cases in this
    narrow a window."""
    target = (birth_sun_longitude - 88) % 360

    def signed_diff(jd: float) -> float:
        lon, _retro = ephemeris.planet_longitudes(jd)["Sun"]
        return ((lon - target + 180) % 360) - 180

    lo, hi = birth_jd - 95, birth_jd - 83
    for _ in range(60):  # converges to sub-second precision well before 60 iterations
        mid = (lo + hi) / 2
        if signed_diff(mid) < 0:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def _all_active_gates(personality_longitudes: dict[str, float], design_longitudes: dict[str, float]) -> set[int]:
    gates = set()
    for lon in personality_longitudes.values():
        gates.add(gate_and_line(lon)[0])
    for lon in design_longitudes.values():
        gates.add(gate_and_line(lon)[0])
    return gates


def defined_centers(active_gates: set[int]) -> set[str]:
    """A center is 'defined' if a complete channel (both its gates) is
    active -- one gate alone doesn't define a center, same principle as a
    bridge needing both ends built."""
    defined = set()
    for gate_a, gate_b in CHANNELS:
        if gate_a in active_gates and gate_b in active_gates:
            defined.add(GATE_TO_CENTER[gate_a])
            defined.add(GATE_TO_CENTER[gate_b])
    return defined


def _channel_is_complete(gate_a: int, gate_b: int, active_gates: set[int]) -> bool:
    return gate_a in active_gates and gate_b in active_gates


def _has_motor_to_throat_channel(active_gates: set[int]) -> bool:
    """True if any complete (both-gates-active) channel directly connects a
    motor center (Sacral/Heart/SolarPlexus/Root) to the Throat -- the
    defining condition for Manifestor/Manifesting Generator vs.
    Projector/Generator."""
    for gate_a, gate_b in CHANNELS:
        if not _channel_is_complete(gate_a, gate_b, active_gates):
            continue
        center_a, center_b = GATE_TO_CENTER[gate_a], GATE_TO_CENTER[gate_b]
        centers = {center_a, center_b}
        if "Throat" in centers and centers & MOTOR_CENTERS:
            return True
    return False


def determine_type(defined: set[str], active_gates: set[int]) -> tuple[str, str]:
    """Returns (type, strategy). Sacral-defined splits Generator/Manifesting
    Generator from everything else; among the rest, a motor connected to
    the Throat by a complete channel makes a Manifestor; any other defined
    center makes a Projector; no defined centers at all makes a Reflector."""
    throat_connected_to_motor = _has_motor_to_throat_channel(active_gates)

    if "Sacral" in defined:
        if throat_connected_to_motor:
            return "Manifesting Generator", "Respond, then inform before acting"
        return "Generator", "Respond"
    if not defined:
        return "Reflector", "Wait a full lunar cycle (~28 days) before major decisions"
    if throat_connected_to_motor:
        return "Manifestor", "Inform before acting"
    return "Projector", "Wait for invitation"


def active_channels(active_gates: set[int]) -> list[tuple[int, int]]:
    """Every complete (both-gates-active) channel, sorted for stable output."""
    return sorted(
        (gate_a, gate_b) for gate_a, gate_b in CHANNELS if _channel_is_complete(gate_a, gate_b, active_gates)
    )


def determine_definition(defined: set[str], channels: list[tuple[int, int]]) -> str:
    """Definition type -- how many separate connected groups the defined
    centers form, found via connected-components on the graph of defined
    centers joined by complete channels. A totally undefined chart
    (Reflector) has no definition at all; everything else has at least one
    connected group, up to a genuine (if rare) Quadruple Split."""
    if not defined:
        return "No Definition"

    adjacency: dict[str, set[str]] = {center: set() for center in defined}
    for gate_a, gate_b in channels:
        center_a, center_b = GATE_TO_CENTER[gate_a], GATE_TO_CENTER[gate_b]
        if center_a in defined and center_b in defined:
            adjacency[center_a].add(center_b)
            adjacency[center_b].add(center_a)

    visited: set[str] = set()
    groups = 0
    for start in defined:
        if start in visited:
            continue
        groups += 1
        stack = [start]
        while stack:
            node = stack.pop()
            if node in visited:
                continue
            visited.add(node)
            stack.extend(adjacency[node] - visited)

    names = {1: "Single Definition", 2: "Split Definition", 3: "Triple Split Definition", 4: "Quadruple Split Definition"}
    return names.get(groups, f"{groups}-Way Split Definition")


def determine_authority(defined: set[str], type_name: str) -> str:
    if type_name == "Reflector":
        return "Lunar Authority"
    for center, authority_name in AUTHORITY_ORDER:
        if center in defined:
            return authority_name
    if "Ajna" in defined or "Throat" in defined:
        return "Environmental (Mental) Authority"
    return "Self-Projected Authority"


def all_points_longitudes(jd: float) -> dict[str, float]:
    """The 13 points Human Design uses: the 10 planets already computed
    elsewhere, plus Earth (always exactly opposite the Sun) and the lunar
    nodes (Mean Node, matching this backend's existing Vedic convention of
    Mean over True node -- see app/calc/ephemeris.py's sidereal_longitudes).

    Mean vs. True node is a genuine, acknowledged split even within the
    Human Design community itself, not a settled standard -- confirmed by
    cross-testing against an independent calculator (see session notes):
    every gate matched exactly across two full test charts, but the Node
    gate's *line* differed by 1-2 (never the gate itself), consistent with
    the well-documented ~1-1.5 degree Mean/True divergence. Everything else
    (Type, Authority, Profile, defined centers) matched exactly in both
    tests regardless of this difference."""
    raw = ephemeris.planet_longitudes(jd)
    points = {name: lon for name, (lon, _retro) in raw.items()}
    points["Earth"] = (points["Sun"] + 180) % 360
    node_pos, _flags = swe.calc_ut(jd, swe.MEAN_NODE)
    points["North Node"] = node_pos[0] % 360
    points["South Node"] = (points["North Node"] + 180) % 360
    return points


def build_chart(birth_datetime_iso: str) -> dict:
    """Builds a Human Design chart from a birth ISO datetime (must carry a
    UTC offset, same rule as the rest of this backend's calc engine).
    Returns a plain dict -- the API layer wraps it in the Pydantic model,
    same separation as the rest of app/calc/."""
    birth_jd = ephemeris.to_julian_day(birth_datetime_iso)
    personality_points = all_points_longitudes(birth_jd)

    design_jd = find_design_julian_day(birth_jd, personality_points["Sun"])
    design_points = all_points_longitudes(design_jd)

    active_gates = _all_active_gates(personality_points, design_points)
    defined = defined_centers(active_gates)
    type_name, strategy = determine_type(defined, active_gates)
    authority = determine_authority(defined, type_name)
    channels = active_channels(active_gates)
    definition = determine_definition(defined, channels)

    _personality_sun_gate, personality_sun_line = gate_and_line(personality_points["Sun"])
    _design_sun_gate, design_sun_line = gate_and_line(design_points["Sun"])
    profile = f"{personality_sun_line}/{design_sun_line}"

    all_centers = set(CENTERS.keys())
    return {
        "type": type_name,
        "strategy": strategy,
        "authority": authority,
        "profile": profile,
        "definition": definition,
        "defined_centers": sorted(defined),
        "undefined_centers": sorted(all_centers - defined),
        "active_gates": sorted(active_gates),
        "active_channels": [
            {"gates": [a, b], "name": CHANNEL_NAMES.get((a, b), f"Channel {a}-{b}")} for a, b in channels
        ],
    }
