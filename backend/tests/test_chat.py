"""Integration tests for /api/chat/reply's auth + rate-limit enforcement,
run through the real FastAPI app via TestClient. Mocks httpx.get so no real
network calls reach Supabase."""

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


def _base_payload():
    return {
        "chart": {
            "planets": [],
            "houses": None,
            "ascendant": None,
            "midheaven": None,
            "aspects": [],
            "patterns": [],
        },
        "numerology": {
            "life_path": 1,
            "expression": 1,
            "soul_urge": 1,
            "personality": 1,
            "personal_year": 1,
        },
        "knowledge": [],
        "messages": [{"role": "user", "content": "hello"}],
    }


def test_chat_reply_requires_authorization(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "anon-key")
    client = TestClient(app)
    resp = client.post("/api/chat/reply", json=_base_payload())
    assert resp.status_code == 401


def test_chat_reply_succeeds_with_valid_auth_under_limit(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "anon-key")

    def fake_get(url, **kwargs):
        if "/auth/v1/user" in url:
            return FakeResponse(200, {"id": "user-123"})
        if "profiles" in url:
            return FakeResponse(200, [{"subscription_tier": "free"}])
        return FakeResponse(200, [], headers={"content-range": "0-0/1"})

    monkeypatch.setattr(httpx, "get", fake_get)
    client = TestClient(app)
    resp = client.post(
        "/api/chat/reply", json=_base_payload(), headers={"Authorization": "Bearer valid-token"}
    )
    assert resp.status_code == 200
    assert "reply" in resp.json()


def test_chat_reply_blocks_free_tier_over_daily_limit(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "anon-key")

    def fake_get(url, **kwargs):
        if "/auth/v1/user" in url:
            return FakeResponse(200, {"id": "user-123"})
        if "profiles" in url:
            return FakeResponse(200, [{"subscription_tier": "free"}])
        return FakeResponse(200, [], headers={"content-range": "0-2/3"})

    monkeypatch.setattr(httpx, "get", fake_get)
    client = TestClient(app)
    resp = client.post(
        "/api/chat/reply", json=_base_payload(), headers={"Authorization": "Bearer valid-token"}
    )
    assert resp.status_code == 429


def test_chat_reply_allows_premium_past_free_limit(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "anon-key")

    def fake_get(url, **kwargs):
        if "/auth/v1/user" in url:
            return FakeResponse(200, {"id": "user-123"})
        if "profiles" in url:
            return FakeResponse(200, [{"subscription_tier": "premium"}])
        return FakeResponse(200, [], headers={"content-range": "0-49/50"})

    monkeypatch.setattr(httpx, "get", fake_get)
    client = TestClient(app)
    resp = client.post(
        "/api/chat/reply", json=_base_payload(), headers={"Authorization": "Bearer valid-token"}
    )
    assert resp.status_code == 200


def test_chat_reply_rejects_oversized_message_payload():
    # Pydantic validates the request body before the endpoint (and therefore
    # auth) ever runs, so this needs no httpx mocking.
    client = TestClient(app)
    payload = _base_payload()
    payload["messages"] = [{"role": "user", "content": "hi"}] * 201
    resp = client.post(
        "/api/chat/reply", json=payload, headers={"Authorization": "Bearer whatever"}
    )
    assert resp.status_code == 422
