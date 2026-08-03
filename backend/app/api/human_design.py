from fastapi import APIRouter, Depends, Request

from app.auth import require_user
from app.calc.human_design import build_chart
from app.calc.models import HumanDesignChart, HumanDesignRequest
from app.rate_limit import limiter

router = APIRouter(prefix="/api/human-design", tags=["human-design"])


@router.post("/chart", response_model=HumanDesignChart)
@limiter.limit("20/minute")
def chart(
    request: Request, body: HumanDesignRequest, _user_id: str = Depends(require_user)
) -> HumanDesignChart:
    result = build_chart(body.datetime)
    return HumanDesignChart(**result)
