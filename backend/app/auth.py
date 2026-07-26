"""Server-side auth verification, used by every route that shouldn't be
callable by anyone who finds the API URL, plus free-tier message-count
limiting specific to /api/chat/reply (the only endpoint proxying to a paid
API). Deliberately uses only the public SUPABASE_ANON_KEY, never the
service_role key — this backend verifies the caller's own session and reads
data through their own RLS policies, rather than holding a key powerful
enough to bypass RLS entirely.

Without enforce_free_tier_limit, anyone who knows the API URL could call
/api/chat/reply directly with unlimited requests — the "3 free messages/day"
limit shown in the frontend is only a client-side display, easily bypassed
by calling the API directly rather than through the UI."""

import os
from datetime import datetime, timezone

import httpx
from fastapi import Header, HTTPException

FREE_DAILY_MESSAGE_LIMIT = 3


def _supabase_config() -> tuple[str, str]:
    url = os.environ.get("SUPABASE_URL")
    anon_key = os.environ.get("SUPABASE_ANON_KEY")
    if not url or not anon_key:
        raise HTTPException(status_code=503, detail="Auth is not configured on the server")
    return url, anon_key


def verify_supabase_user(authorization: str | None) -> str:
    """Verifies a Supabase access token against Supabase Auth's own /user
    endpoint and returns the authenticated user's id. Raises 401 if the
    header is missing or the token is invalid/expired."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.removeprefix("Bearer ")
    url, anon_key = _supabase_config()

    try:
        resp = httpx.get(
            f"{url}/auth/v1/user",
            headers={"apikey": anon_key, "Authorization": f"Bearer {token}"},
            timeout=10,
        )
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Couldn't reach the auth service")

    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    user_id = resp.json().get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid session response")
    return user_id


def require_user(authorization: str | None = Header(default=None)) -> str:
    """FastAPI dependency form of verify_supabase_user, for routes that only
    need to confirm the caller is signed in (chart/numerology calculations
    don't need the user's identity, just that they're not open to anyone who
    finds the API URL)."""
    return verify_supabase_user(authorization)


def enforce_free_tier_limit(user_id: str, token: str) -> None:
    """Raises 429 if this user is on the free tier and has already sent
    FREE_DAILY_MESSAGE_LIMIT user messages today. Queries through the
    caller's own token (not service_role), so existing RLS policies already
    scope every read to this user's own rows."""
    url, anon_key = _supabase_config()
    headers = {"apikey": anon_key, "Authorization": f"Bearer {token}"}

    profile_resp = httpx.get(
        f"{url}/rest/v1/profiles",
        params={"id": f"eq.{user_id}", "select": "subscription_tier"},
        headers=headers,
        timeout=10,
    )
    tier = "free"
    if profile_resp.status_code == 200:
        rows = profile_resp.json()
        if rows:
            tier = rows[0].get("subscription_tier") or "free"
    if tier != "free":
        return

    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    ).isoformat()
    count_resp = httpx.get(
        f"{url}/rest/v1/chat_messages",
        params={"select": "id", "role": "eq.user", "created_at": f"gte.{today_start}"},
        headers={**headers, "Prefer": "count=exact"},
        timeout=10,
    )
    count = 0
    content_range = count_resp.headers.get("content-range", "")
    if "/" in content_range:
        total = content_range.split("/")[-1]
        if total.isdigit():
            count = int(total)

    if count >= FREE_DAILY_MESSAGE_LIMIT:
        raise HTTPException(status_code=429, detail="Daily free message limit reached")
