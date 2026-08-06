from fastapi import APIRouter, Depends, Request

from app.auth import require_user
from app.calc.matrix_of_destiny import build_matrix
from app.calc.models import MatrixOfDestinyRequest, MatrixOfDestinyResponse
from app.rate_limit import limiter

router = APIRouter(prefix="/api/matrix-of-destiny", tags=["matrix-of-destiny"])


@router.post("/chart", response_model=MatrixOfDestinyResponse)
@limiter.limit("20/minute")
def chart(
    request: Request, body: MatrixOfDestinyRequest, _user_id: str = Depends(require_user)
) -> MatrixOfDestinyResponse:
    result = build_matrix(body.birth_date)
    return MatrixOfDestinyResponse(**result)
