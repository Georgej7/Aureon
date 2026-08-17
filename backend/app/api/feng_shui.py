from fastapi import APIRouter, Depends, Header, Request

from app.auth import enforce_exact_tier, require_user, verify_supabase_user
from app.calc.bagua import bagua_zones
from app.calc.feng_shui import KUA_DATA, kua_number
from app.calc.models import BaguaRequest, BaguaResponse, KuaProfile, KuaRequest
from app.rate_limit import limiter

router = APIRouter(prefix="/api/feng-shui", tags=["feng-shui"])


@router.post("/kua", response_model=KuaProfile)
@limiter.limit("20/minute")
def kua(request: Request, body: KuaRequest, _user_id: str = Depends(require_user)) -> KuaProfile:
    number = kua_number(body.birth_year, body.gender)
    data = KUA_DATA[number]
    return KuaProfile(kua_number=number, **data)


@router.post("/bagua", response_model=BaguaResponse)
@limiter.limit("20/minute")
def bagua(request: Request, body: BaguaRequest, authorization: str | None = Header(default=None)) -> BaguaResponse:
    # Bagua mapping is a VIP-exclusive perk (frontend/app/feng-shui/page.tsx's
    # gate is `tier !== "vip"`, not "at least" anything) -- was previously
    # only a frontend conditional, so any signed-in user could call this
    # directly and get it for free. Kua above stays ungated; it's shown to
    # every tier already.
    user_id = verify_supabase_user(authorization)
    token = authorization.removeprefix("Bearer ")  # verify_supabase_user already validated this is present
    enforce_exact_tier(user_id, token, "vip")
    return BaguaResponse(zones=bagua_zones(body.facing_direction))
