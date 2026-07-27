from fastapi import APIRouter, Depends, Request

from app.auth import require_user
from app.calc.feng_shui import KUA_DATA, kua_number
from app.calc.models import KuaProfile, KuaRequest
from app.rate_limit import limiter

router = APIRouter(prefix="/api/feng-shui", tags=["feng-shui"])


@router.post("/kua", response_model=KuaProfile)
@limiter.limit("20/minute")
def kua(request: Request, body: KuaRequest, _user_id: str = Depends(require_user)) -> KuaProfile:
    number = kua_number(body.birth_year, body.gender)
    data = KUA_DATA[number]
    return KuaProfile(kua_number=number, **data)
