from datetime import date

from fastapi import APIRouter, Header, Request

from app.auth import enforce_min_tier, verify_supabase_user
from app.calc.electional import scan_financial_favorability
from app.calc.models import ElectionalDay, ElectionalScanRequest, ElectionalScanResponse
from app.rate_limit import limiter

router = APIRouter(prefix="/api/electional", tags=["electional"])


@router.post("/financial-timing", response_model=ElectionalScanResponse)
@limiter.limit("10/minute")
def financial_timing(
    request: Request, body: ElectionalScanRequest, authorization: str | None = Header(default=None)
) -> ElectionalScanResponse:
    # Premium feature (frontend/app/timing/page.tsx's gate) -- previously
    # only a frontend conditional, so any signed-in user could call this
    # directly and get it for free, the same bypass already closed on
    # vedic/synastry/bagua.
    user_id = verify_supabase_user(authorization)
    token = authorization.removeprefix("Bearer ")  # verify_supabase_user already validated this is present
    enforce_min_tier(user_id, token, "premium")
    birth = date.fromisoformat(body.birth_date)
    start = date.fromisoformat(body.start_date)
    days = [ElectionalDay(**d) for d in scan_financial_favorability(birth, start, body.days)]
    return ElectionalScanResponse(days=days)
