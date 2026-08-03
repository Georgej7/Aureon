from datetime import date

from fastapi import APIRouter, Depends, Request

from app.auth import require_user
from app.calc.electional import scan_financial_favorability
from app.calc.models import ElectionalDay, ElectionalScanRequest, ElectionalScanResponse
from app.rate_limit import limiter

router = APIRouter(prefix="/api/electional", tags=["electional"])


@router.post("/financial-timing", response_model=ElectionalScanResponse)
@limiter.limit("10/minute")
def financial_timing(
    request: Request, body: ElectionalScanRequest, _user_id: str = Depends(require_user)
) -> ElectionalScanResponse:
    birth = date.fromisoformat(body.birth_date)
    start = date.fromisoformat(body.start_date)
    days = [ElectionalDay(**d) for d in scan_financial_favorability(birth, start, body.days)]
    return ElectionalScanResponse(days=days)
