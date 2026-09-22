from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..services.rendered_versions import attach_rendered_asset

router=APIRouter()

class RenderedAssetBody(BaseModel):
    version:dict
    output_path:str

@router.post("/attach")
def attach(body:RenderedAssetBody):
    try:
        return attach_rendered_asset(body.version,body.output_path)
    except FileNotFoundError:
        raise HTTPException(404,"Rendered media file not found")
    except ValueError as exc:
        raise HTTPException(400,str(exc))
