from fastapi import APIRouter, Depends, Request

from app.auth import require_user
from app.calc.astrocartography import build_astrocartography
from app.calc.models import AstrocartographyRequest, AstrocartographyResponse
from app.rate_limit import limiter

router = APIRouter(prefix="/api/astrocartography", tags=["astrocartography"])


@router.post("/lines", response_model=AstrocartographyResponse)
@limiter.limit("15/minute")
def astrocartography_lines(
    request: Request, body: AstrocartographyRequest, _user_id: str = Depends(require_user)
) -> AstrocartographyResponse:
    lines = build_astrocartography(body.birth)
    return AstrocartographyResponse(lines=lines)
