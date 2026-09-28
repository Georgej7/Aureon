from fastapi import APIRouter, Header, Request

from app.auth import enforce_min_tier, verify_supabase_user
from app.calc.astrocartography import build_astrocartography
from app.calc.models import AstrocartographyRequest, AstrocartographyResponse
from app.rate_limit import limiter

router = APIRouter(prefix="/api/astrocartography", tags=["astrocartography"])


@router.post("/lines", response_model=AstrocartographyResponse)
@limiter.limit("15/minute")
def astrocartography_lines(
    request: Request, body: AstrocartographyRequest, authorization: str | None = Header(default=None)
) -> AstrocartographyResponse:
    # Premium feature (frontend/app/astrocartography/page.tsx's gate) --
    # previously only a frontend conditional, so any signed-in user could
    # call this directly and get it for free, the same bypass already
    # closed on vedic/synastry/bagua.
    user_id = verify_supabase_user(authorization)
    token = authorization.removeprefix("Bearer ")  # verify_supabase_user already validated this is present
    enforce_min_tier(user_id, token, "premium")
    lines = build_astrocartography(body.birth)
    return AstrocartographyResponse(lines=lines)
