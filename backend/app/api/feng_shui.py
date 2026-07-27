from fastapi import APIRouter, Depends, Request

from app.auth import require_user
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
def bagua(request: Request, body: BaguaRequest, _user_id: str = Depends(require_user)) -> BaguaResponse:
    return BaguaResponse(zones=bagua_zones(body.facing_direction))
