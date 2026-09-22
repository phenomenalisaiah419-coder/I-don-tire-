from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..ai_director import DirectorContext, generate_validated_plan
from ..services.clarification_engine import build_critical_questions

router=APIRouter()

class DirectorRequest(BaseModel):
    instruction:str
    project:dict={}
    media:list[dict]=[]
    capabilities:dict={}
    evidence:dict={}


class ClarifyRequest(BaseModel):
    instruction: str
    media: list[dict] = []
    answers: dict[str, str] = {}

@router.post("/clarify")
async def clarify(body: ClarifyRequest):
    """Return only high-impact pick-list questions for the current request/media."""
    if not body.instruction.strip():
        raise HTTPException(422, "Editing instruction cannot be empty")
    return {
        "questions": build_critical_questions(body.instruction, body.media, body.answers),
        "max_options_per_question": 4,
    }

@router.post("/plan")
async def create_plan(body:DirectorRequest):
    # Provider injection is performed by the deployment/application composition layer.
    # This endpoint deliberately refuses to fabricate a plan when none is configured.
    raise HTTPException(503,"No AI Director provider configured")
