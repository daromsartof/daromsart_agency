from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.security import require_api_key

router = APIRouter(prefix="/v1", tags=["example"])


class EchoRequest(BaseModel):
    message: str


class EchoResponse(BaseModel):
    message: str
    length: int


@router.post("/echo", response_model=EchoResponse, dependencies=[Depends(require_api_key)])
def echo(payload: EchoRequest) -> EchoResponse:
    """Endpoint d'exemple protégé par clé API — point de départ à remplacer."""
    return EchoResponse(message=payload.message, length=len(payload.message))
