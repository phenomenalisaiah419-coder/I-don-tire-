import os
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from ..db import get_db
from ..models import RenderJob, MediaAsset, Project
from ..schemas import RenderRequest
from ..media_engine import trim, execute_operation, ensure_ffmpeg

router = APIRouter()


class OperationRenderRequest(BaseModel):
    project_id: int
    input_asset_id: int
    operation: str = Field(..., min_length=1)
    params: dict = {}


@router.post("/render")
def render(body: RenderRequest, db: Session = Depends(get_db)):
    if not ensure_ffmpeg():
        raise HTTPException(503, "FFmpeg not available on this host")
    asset = db.get(MediaAsset, body.input_asset_id)
    if not asset:
        raise HTTPException(404, "Media asset not found")
    if not db.get(Project, body.project_id):
        raise HTTPException(404, "Project not found")
    if body.start is None or body.end is None or body.end <= body.start:
        raise HTTPException(400, "A valid start/end range is required")
    out_dir = os.path.dirname(asset.path) or settings_media_root()
    os.makedirs(out_dir, exist_ok=True)
    output = os.path.join(out_dir, f"{uuid.uuid4().hex}_render.mp4")
    job = RenderJob(
        project_id=body.project_id,
        status="PROCESSING",
        progress=10,
        input_path=asset.path,
        output_path=output,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    try:
        trim(asset.path, output, body.start, body.end)
        job.status = "COMPLETED"
        job.progress = 100
    except Exception as exc:
        job.status = "FAILED"
        job.error = str(exc)
        job.progress = 0
        db.commit()
        raise HTTPException(500, f"Render failed: {exc}") from exc
    db.commit()
    return {"job_id": job.id, "status": job.status, "output_path": output}


@router.post("/execute")
def execute_op(body: OperationRenderRequest, db: Session = Depends(get_db)):
    if not ensure_ffmpeg():
        raise HTTPException(503, "FFmpeg not available on this host")
    asset = db.get(MediaAsset, body.input_asset_id)
    if not asset:
        raise HTTPException(404, "Media asset not found")
    if not db.get(Project, body.project_id):
        raise HTTPException(404, "Project not found")
    out_dir = os.path.dirname(asset.path) or settings_media_root()
    os.makedirs(out_dir, exist_ok=True)
    output = os.path.join(out_dir, f"{uuid.uuid4().hex}_{body.operation}.mp4")
    job = RenderJob(
        project_id=body.project_id,
        status="PROCESSING",
        progress=10,
        input_path=asset.path,
        output_path=output,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    try:
        execute_operation(body.operation, asset.path, output, body.params)
        job.status = "COMPLETED"
        job.progress = 100
    except Exception as exc:
        job.status = "FAILED"
        job.error = str(exc)
        job.progress = 0
        db.commit()
        raise HTTPException(500, f"Operation failed: {exc}") from exc
    db.commit()
    return {"job_id": job.id, "status": job.status, "output_path": output, "operation": body.operation}


@router.get("/{job_id}")
def get_job(job_id: int, db: Session = Depends(get_db)):
    job = db.get(RenderJob, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return {
        "id": job.id,
        "project_id": job.project_id,
        "status": job.status,
        "progress": job.progress,
        "output_path": job.output_path,
        "error": job.error,
        "created_at": job.created_at.isoformat() if job.created_at else None,
    }


def settings_media_root() -> str:
    from ..config import settings
    return settings.media_root
