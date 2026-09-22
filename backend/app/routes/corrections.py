from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..correction_loop import build_correction_context

router=APIRouter()

class CorrectionBody(BaseModel):
    correction: str
    project: dict = {}
    media: list[dict] = []
    capabilities: dict = {}
    evidence: dict = {}
    previous_plan: dict | None = None

@router.post("/prepare")
def prepare_correction(body: CorrectionBody):
    try:
        return build_correction_context(
            body.project, body.media, body.capabilities, body.evidence,
            body.previous_plan, body.correction
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc))
