"""Verifies /api/chart/* and /api/numerology now require auth. Before this,
these endpoints were open to anyone who found the API URL — no auth, no rate
limit — even though the only real caller (onboarding) is already
authenticated. Mocks httpx.get so no real network calls reach Supabase."""

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app


class FakeResponse:
    def __init__(self, status_code, json_data=None):
        self.status_code = status_code
        self._json_data = json_data if json_data is not None else {}

    def json(self):
        return self._json_data


def _tier_get(tier: str):
    # vedic and bagua now also check subscription_tier server-side (see
    # test_chart_tier_gating.py) -- a single flat FakeResponse for every
    # httpx.get call no longer works for those two, since the tier-check
    # hits a *second* URL (/rest/v1/profiles, expecting a list of rows)
    # after the auth check (/auth/v1/user, expecting a dict).
    def fake_get(url, **kwargs):
        if "/auth/v1/user" in url:
            return FakeResponse(200, {"id": "user-123"})
        if "profiles" in url:
            return FakeResponse(200, [{"subscription_tier": tier}])
        return FakeResponse(200, [])

    return fake_get


@pytest.fixture(autouse=True)
def supabase_env(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "test-anon-key")


@pytest.fixture
def client():
    return TestClient(app)


def _valid_birth():
    return {"datetime": "1993-03-14T04:12:00-05:00", "latitude": 40.7, "longitude": -74.0}


def test_natal_chart_requires_authorization(client):
    resp = client.post("/api/chart/natal", json=_valid_birth())
    assert resp.status_code == 401


def test_natal_chart_succeeds_with_valid_auth(client, monkeypatch):
    monkeypatch.setattr(httpx, "get", lambda *a, **k: FakeResponse(200, {"id": "user-123"}))
    resp = client.post(
        "/api/chart/natal", json=_valid_birth(), headers={"Authorization": "Bearer valid-token"}
    )
    assert resp.status_code == 200
    assert "planets" in resp.json()


def test_vedic_chart_requires_authorization(client):
    resp = client.post("/api/chart/vedic", json=_valid_birth())
    assert resp.status_code == 401


def test_vedic_chart_succeeds_with_valid_auth(client, monkeypatch):
    monkeypatch.setattr(httpx, "get", _tier_get("premium"))
    resp = client.post(
        "/api/chart/vedic", json=_valid_birth(), headers={"Authorization": "Bearer valid-token"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "planets" in body
    assert "moon_nakshatra" in body
    assert "current_mahadasha" in body


def test_transits_requires_authorization(client):
    resp = client.post("/api/chart/transits", json={"natal_planets": []})
    assert resp.status_code == 401


def test_synastry_requires_authorization(client):
    resp = client.post(
        "/api/chart/synastry", json={"person_a": _valid_birth(), "person_b": _valid_birth()}
    )
    assert resp.status_code == 401


def test_numerology_requires_authorization(client):
    resp = client.post("/api/numerology", json={"full_name": "John Smith", "date": "1990-01-15"})
    assert resp.status_code == 401


def test_numerology_succeeds_with_valid_auth(client, monkeypatch):
    monkeypatch.setattr(httpx, "get", lambda *a, **k: FakeResponse(200, {"id": "user-123"}))
    resp = client.post(
        "/api/numerology",
        json={"full_name": "John Smith", "date": "1990-01-15"},
        headers={"Authorization": "Bearer valid-token"},
    )
    assert resp.status_code == 200
    assert resp.json()["life_path"] == 8


def test_kua_requires_authorization(client):
    resp = client.post("/api/feng-shui/kua", json={"birth_year": 1990, "gender": "female"})
    assert resp.status_code == 401


def test_kua_succeeds_with_valid_auth(client, monkeypatch):
    monkeypatch.setattr(httpx, "get", lambda *a, **k: FakeResponse(200, {"id": "user-123"}))
    resp = client.post(
        "/api/feng-shui/kua",
        json={"birth_year": 1990, "gender": "female"},
        headers={"Authorization": "Bearer valid-token"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "kua_number" in body
    assert "sheng_chi" in body


def test_bagua_requires_authorization(client):
    resp = client.post("/api/feng-shui/bagua", json={"facing_direction": "N"})
    assert resp.status_code == 401


def test_bagua_succeeds_with_valid_auth(client, monkeypatch):
    monkeypatch.setattr(httpx, "get", _tier_get("vip"))
    resp = client.post(
        "/api/feng-shui/bagua",
        json={"facing_direction": "N"},
        headers={"Authorization": "Bearer valid-token"},
    )
    assert resp.status_code == 200
    zones = resp.json()["zones"]
    assert len(zones) == 9
