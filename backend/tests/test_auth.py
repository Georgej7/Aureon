"""Verifies the server-side auth + free-tier limit enforcement added to
/api/chat/reply. Before this, the "3 free messages/day" limit only existed
as a client-side count in the frontend — anyone calling the API directly
bypassed it entirely. These tests mock httpx.get (no real network calls)
since app.auth calls Supabase's own REST/Auth endpoints directly."""

import httpx
import pytest
from fastapi import HTTPException

from app.auth import enforce_free_tier_limit, verify_supabase_user


class FakeResponse:
    def __init__(self, status_code, json_data=None, headers=None):
        self.status_code = status_code
        self._json_data = json_data if json_data is not None else {}
        self.headers = headers or {}

    def json(self):
        return self._json_data


@pytest.fixture(autouse=True)
def supabase_env(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "test-anon-key")


def test_verify_supabase_user_rejects_missing_header():
    with pytest.raises(HTTPException) as exc:
        verify_supabase_user(None)
    assert exc.value.status_code == 401


def test_verify_supabase_user_rejects_malformed_header():
    with pytest.raises(HTTPException) as exc:
        verify_supabase_user("not-a-bearer-token")
    assert exc.value.status_code == 401


def test_verify_supabase_user_returns_id_on_valid_token(monkeypatch):
    monkeypatch.setattr(httpx, "get", lambda *a, **k: FakeResponse(200, {"id": "user-123"}))
    assert verify_supabase_user("Bearer real-token") == "user-123"


def test_verify_supabase_user_rejects_invalid_or_expired_token(monkeypatch):
    monkeypatch.setattr(httpx, "get", lambda *a, **k: FakeResponse(401, {}))
    with pytest.raises(HTTPException) as exc:
        verify_supabase_user("Bearer expired-token")
    assert exc.value.status_code == 401


def test_enforce_free_tier_limit_allows_premium_regardless_of_count(monkeypatch):
    def fake_get(url, **kwargs):
        if "profiles" in url:
            return FakeResponse(200, [{"subscription_tier": "premium"}])
        return FakeResponse(200, [], headers={"content-range": "0-99/100"})

    monkeypatch.setattr(httpx, "get", fake_get)
    enforce_free_tier_limit("user-123", "token")  # must not raise


def test_enforce_free_tier_limit_allows_free_under_limit(monkeypatch):
    def fake_get(url, **kwargs):
        if "profiles" in url:
            return FakeResponse(200, [{"subscription_tier": "free"}])
        return FakeResponse(200, [], headers={"content-range": "0-1/2"})

    monkeypatch.setattr(httpx, "get", fake_get)
    enforce_free_tier_limit("user-123", "token")  # 2 messages today, limit is 3 -> allowed


def test_enforce_free_tier_limit_blocks_free_at_limit(monkeypatch):
    def fake_get(url, **kwargs):
        if "profiles" in url:
            return FakeResponse(200, [{"subscription_tier": "free"}])
        return FakeResponse(200, [], headers={"content-range": "0-2/3"})

    monkeypatch.setattr(httpx, "get", fake_get)
    with pytest.raises(HTTPException) as exc:
        enforce_free_tier_limit("user-123", "token")
    assert exc.value.status_code == 429


def test_enforce_free_tier_limit_defaults_to_free_when_profile_row_missing(monkeypatch):
    def fake_get(url, **kwargs):
        if "profiles" in url:
            return FakeResponse(200, [])  # no matching profile row
        return FakeResponse(200, [], headers={"content-range": "0-2/3"})

    monkeypatch.setattr(httpx, "get", fake_get)
    with pytest.raises(HTTPException) as exc:
        enforce_free_tier_limit("user-123", "token")
    assert exc.value.status_code == 429
