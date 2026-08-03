from fastapi import APIRouter, Depends, Request

from app.auth import require_user
from app.calc.chinese_astrology import chinese_zodiac
from app.calc.models import ChineseZodiacProfile, ChineseZodiacRequest
from app.rate_limit import limiter

router = APIRouter(prefix="/api/chinese-astrology", tags=["chinese-astrology"])


@router.post("/zodiac", response_model=ChineseZodiacProfile)
@limiter.limit("20/minute")
def zodiac(
    request: Request, body: ChineseZodiacRequest, _user_id: str = Depends(require_user)
) -> ChineseZodiacProfile:
    animal, element, yin_yang = chinese_zodiac(body.birth_year)
    return ChineseZodiacProfile(animal=animal, element=element, yin_yang=yin_yang)
