"""Verifies vedic/synastry/solar-return/progressed/davison/composite/bagua
now actually enforce their subscription-tier gate server-side. Before this,
the gate existed only as a frontend React conditional -- anyone with a valid
session token could call these endpoints directly and get the paid chart
data for free. Mocks httpx.get so no real network calls reach Supabase;
follows the same fake_get-inspects-url pattern as test_chat.py's tier
tests."""

import httpx
from fastapi.testclient import TestClient

from app.main import app


class FakeResponse:
    def __init__(self, status_code, json_data=None, headers=None):
        self.status_code = status_code
        self._json_data = json_data if json_data is not None else {}
        self.headers = headers or {}

    def json(self):
        return self._json_data


def _valid_birth():
    return {"datetime": "1993-03-14T04:12:00-05:00", "latitude": 40.7, "longitude": -74.0}


def _tier_get(tier: str):
    def fake_get(url, **kwargs):
        if "/auth/v1/user" in url:
            return FakeResponse(200, {"id": "user-123"})
        if "profiles" in url:
            return FakeResponse(200, [{"subscription_tier": tier}])
        return FakeResponse(200, [])

    return fake_get


def _env(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "anon-key")


def _auth_headers():
    return {"Authorization": "Bearer valid-token"}


# ---- vedic: requires premium or higher ----


def test_vedic_blocks_free_tier(monkeypatch):
    _env(monkeypatch)
    monkeypatch.setattr(httpx, "get", _tier_get("free"))
    client = TestClient(app)
    resp = client.post("/api/chart/vedic", json=_valid_birth(), headers=_auth_headers())
    assert resp.status_code == 403


def test_vedic_allows_premium(monkeypatch):
    _env(monkeypatch)
    monkeypatch.setattr(httpx, "get", _tier_get("premium"))
    client = TestClient(app)
    resp = client.post("/api/chart/vedic", json=_valid_birth(), headers=_auth_headers())
    assert resp.status_code == 200


# ---- synastry: requires premium or higher ----


def test_synastry_blocks_free_tier(monkeypatch):
    _env(monkeypatch)
    monkeypatch.setattr(httpx, "get", _tier_get("free"))
    client = TestClient(app)
    resp = client.post(
        "/api/chart/synastry",
        json={"person_a": _valid_birth(), "person_b": _valid_birth()},
        headers=_auth_headers(),
    )
    assert resp.status_code == 403


def test_synastry_allows_premium(monkeypatch):
    _env(monkeypatch)
    monkeypatch.setattr(httpx, "get", _tier_get("premium"))
    client = TestClient(app)
    resp = client.post(
        "/api/chart/synastry",
        json={"person_a": _valid_birth(), "person_b": _valid_birth()},
        headers=_auth_headers(),
    )
    assert resp.status_code == 200


# ---- solar-return / progressed / davison / composite: require practitioner ----


def test_solar_return_blocks_vip_tier(monkeypatch):
    # vip is a parallel add-on to premium, not a superset of practitioner --
    # this specifically checks vip doesn't accidentally satisfy a
    # practitioner-only gate.
    _env(monkeypatch)
    monkeypatch.setattr(httpx, "get", _tier_get("vip"))
    client = TestClient(app)
    resp = client.post(
        "/api/chart/solar-return",
        json={"birth": _valid_birth(), "target_year": 2026},
        headers=_auth_headers(),
    )
    assert resp.status_code == 403


def test_solar_return_allows_practitioner(monkeypatch):
    _env(monkeypatch)
    monkeypatch.setattr(httpx, "get", _tier_get("practitioner"))
    client = TestClient(app)
    resp = client.post(
        "/api/chart/solar-return",
        json={"birth": _valid_birth(), "target_year": 2026},
        headers=_auth_headers(),
    )
    assert resp.status_code == 200


def test_progressed_blocks_premium_tier(monkeypatch):
    _env(monkeypatch)
    monkeypatch.setattr(httpx, "get", _tier_get("premium"))
    client = TestClient(app)
    resp = client.post(
        "/api/chart/progressed",
        json={"birth": _valid_birth(), "target_date": "2026-01-01T00:00:00+00:00"},
        headers=_auth_headers(),
    )
    assert resp.status_code == 403


def test_progressed_allows_practitioner(monkeypatch):
    _env(monkeypatch)
    monkeypatch.setattr(httpx, "get", _tier_get("practitioner"))
    client = TestClient(app)
    resp = client.post(
        "/api/chart/progressed",
        json={"birth": _valid_birth(), "target_date": "2026-01-01T00:00:00+00:00"},
        headers=_auth_headers(),
    )
    assert resp.status_code == 200


def test_davison_blocks_free_tier(monkeypatch):
    _env(monkeypatch)
    monkeypatch.setattr(httpx, "get", _tier_get("free"))
    client = TestClient(app)
    resp = client.post(
        "/api/chart/davison",
        json={"person_a": _valid_birth(), "person_b": _valid_birth()},
        headers=_auth_headers(),
    )
    assert resp.status_code == 403


def test_davison_allows_practitioner(monkeypatch):
    _env(monkeypatch)
    monkeypatch.setattr(httpx, "get", _tier_get("practitioner"))
    client = TestClient(app)
    resp = client.post(
        "/api/chart/davison",
        json={"person_a": _valid_birth(), "person_b": _valid_birth()},
        headers=_auth_headers(),
    )
    assert resp.status_code == 200


def test_composite_blocks_free_tier(monkeypatch):
    _env(monkeypatch)
    monkeypatch.setattr(httpx, "get", _tier_get("free"))
    client = TestClient(app)
    resp = client.post(
        "/api/chart/composite",
        json={"person_a": _valid_birth(), "person_b": _valid_birth()},
        headers=_auth_headers(),
    )
    assert resp.status_code == 403


def test_composite_allows_practitioner(monkeypatch):
    _env(monkeypatch)
    monkeypatch.setattr(httpx, "get", _tier_get("practitioner"))
    client = TestClient(app)
    resp = client.post(
        "/api/chart/composite",
        json={"person_a": _valid_birth(), "person_b": _valid_birth()},
        headers=_auth_headers(),
    )
    assert resp.status_code == 200


def test_composite_still_requires_authorization(monkeypatch):
    _env(monkeypatch)
    client = TestClient(app)
    resp = client.post(
        "/api/chart/composite",
        json={"person_a": _valid_birth(), "person_b": _valid_birth()},
    )
    assert resp.status_code == 401


# ---- bagua: VIP-exclusive, not "at least vip" -- practitioner ranks higher
# than vip numerically but doesn't include this perk, so it must NOT pass ----


def test_bagua_blocks_free_tier(monkeypatch):
    _env(monkeypatch)
    monkeypatch.setattr(httpx, "get", _tier_get("free"))
    client = TestClient(app)
    resp = client.post(
        "/api/feng-shui/bagua", json={"facing_direction": "N"}, headers=_auth_headers()
    )
    assert resp.status_code == 403


def test_bagua_blocks_practitioner_tier(monkeypatch):
    _env(monkeypatch)
    monkeypatch.setattr(httpx, "get", _tier_get("practitioner"))
    client = TestClient(app)
    resp = client.post(
        "/api/feng-shui/bagua", json={"facing_direction": "N"}, headers=_auth_headers()
    )
    assert resp.status_code == 403


def test_bagua_allows_vip(monkeypatch):
    _env(monkeypatch)
    monkeypatch.setattr(httpx, "get", _tier_get("vip"))
    client = TestClient(app)
    resp = client.post(
        "/api/feng-shui/bagua", json={"facing_direction": "N"}, headers=_auth_headers()
    )
    assert resp.status_code == 200


def test_kua_remains_ungated_by_tier(monkeypatch):
    # Kua is shown to every signed-in tier already (unlike bagua) -- this is
    # a regression check that the feng_shui.py edit didn't accidentally
    # start gating it too.
    _env(monkeypatch)
    monkeypatch.setattr(httpx, "get", _tier_get("free"))
    client = TestClient(app)
    resp = client.post(
        "/api/feng-shui/kua",
        json={"birth_year": 1990, "gender": "female"},
        headers=_auth_headers(),
    )
    assert resp.status_code == 200
