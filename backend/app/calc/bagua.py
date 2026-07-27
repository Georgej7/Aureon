"""BTB (Black Sect Tantric Buddhist) Bagua map — the accessible, non-compass
school of feng shui room analysis, verified against two independent
published sources before implementation (see session notes): the grid
itself is FIXED relative to the entrance (bottom row = Knowledge/Career/
Helpful People, always), not rotated by compass bearing — that's the
defining difference from classical compass-based (San He) feng shui, which
this deliberately is not.

Real compass directions per zone are a separate, honest addition on top of
that fixed grid: given the direction someone faces when walking in through
the entrance, each zone's approximate compass bearing follows directly from
its position in the grid (top row = the facing direction, bottom row = the
opposite, etc.). This lets each zone be checked against a person's personal
Kua directions — a genuinely useful cross-reference, but a construction of
ours, not a named traditional technique in either school. Framed honestly
as practical guidance, not double-blind-verified ancient methodology.
"""

COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]

# (zone, element) at each grid position, entrance always on the bottom row.
# Verified identically across two independent published sources.
BAGUA_GRID = {
    "top_left": {"zone": "Wealth & Fortune", "element": "Wood"},
    "top_center": {"zone": "Fame & Reputation", "element": "Fire"},
    "top_right": {"zone": "Love & Relationships", "element": "Earth"},
    "middle_left": {"zone": "Family", "element": "Wood"},
    "center": {"zone": "Health & Well-Being", "element": "Earth"},
    "middle_right": {"zone": "Children & Creativity", "element": "Metal"},
    "bottom_left": {"zone": "Knowledge & Wisdom", "element": "Earth"},
    "bottom_center": {"zone": "Career & Life Path", "element": "Water"},
    "bottom_right": {"zone": "Helpful People & Travel", "element": "Metal"},
}

# Step offset (each step = 45 degrees) from the facing direction for each
# zone — derived geometrically (see session notes for the top-down
# floor-plan reasoning) and sanity-checked by hand before use, not just
# trusted from the formula alone.
_ZONE_OFFSETS = {
    "top_center": 0,
    "top_left": -1,
    "top_right": 1,
    "middle_left": -2,
    "middle_right": 2,
    "bottom_center": 4,
    "bottom_left": 5,
    "bottom_right": 3,
}


def bagua_zones(facing_direction: str) -> list[dict]:
    """Returns the 9 zones (8 outer + center) with each outer zone's
    approximate real compass direction, given the compass direction someone
    faces when walking in through the room's entrance. Center has no
    direction — it has no wall to be oriented toward."""
    facing_index = COMPASS.index(facing_direction)
    zones = []
    for position, info in BAGUA_GRID.items():
        if position == "center":
            direction = None
        else:
            offset = _ZONE_OFFSETS[position]
            direction = COMPASS[(facing_index + offset) % 8]
        zones.append({"position": position, "zone": info["zone"], "element": info["element"], "direction": direction})
    return zones
