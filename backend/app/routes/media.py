import hashlib
import os
import uuid
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import MediaAsset, Project, User
from ..config import settings
from ..media_engine import ensure_ffmpeg, probe
from ..security import get_current_user

router = APIRouter()
ALLOWED = {
    "video/mp4", "video/quicktime", "video/webm",
    "audio/mpeg", "audio/wav", "audio/x-wav",
    "image/jpeg", "image/png", "image/webp",
}
MAX_BYTES = 2 * 1024 * 1024 * 1024


def _owned_project(db: Session, project_id: int, user: User) -> Project:
    project = db.get(Project, project_id)
    if not project or project.owner_id != user.id:
        raise HTTPException(404, "Project not found")
    return project


def _validate_probe(meta: dict, declared_mime: str) -> None:
    """Reject files that ffprobe cannot identify as usable media."""
    if not meta.get("format"):
        raise HTTPException(422, "Media content could not be identified")
    duration = meta.get("duration") or 0
    if duration < 0:
        raise HTTPException(422, "Invalid media duration")
    if declared_mime.startswith("video/") and not meta.get("video"):
        raise HTTPException(422, "File is not a valid video")
    if declared_mime.startswith("audio/") and not meta.get("audio"):
        raise HTTPException(422, "File is not a valid audio file")
    if declared_mime.startswith("image/") and not meta.get("video"):
        # ffprobe represents still images as a video stream in normal image formats.
        raise HTTPException(422, "File is not a valid image")


@router.post("/upload")
async def upload(
    project_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _owned_project(db, project_id, user)
    declared = (file.content_type or "").lower()
    if declared not in ALLOWED:
        raise HTTPException(415, f"Unsupported media type: {declared or 'unknown'}")

    os.makedirs(settings.media_root, exist_ok=True)
    safe_name = f"{uuid.uuid4().hex}_{os.path.basename(file.filename or 'media')}"
    path = os.path.join(settings.media_root, safe_name)
    size = 0
    digest = hashlib.sha256()
    try:
        with open(path, "wb") as out:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_BYTES:
                    raise HTTPException(413, "Media file too large")
                digest.update(chunk)
                out.write(chunk)
    except HTTPException:
        Path(path).unlink(missing_ok=True)
        raise
    except Exception as exc:
        Path(path).unlink(missing_ok=True)
        raise HTTPException(500, f"Upload failed: {exc}") from exc
    finally:
        await file.close()

    if not ensure_ffmpeg():
        Path(path).unlink(missing_ok=True)
        raise HTTPException(503, "Media validation unavailable: FFmpeg/ffprobe not available")

    try:
        meta = probe(path)
        _validate_probe(meta, declared)
    except HTTPException:
        Path(path).unlink(missing_ok=True)
        raise
    except Exception as exc:
        Path(path).unlink(missing_ok=True)
        raise HTTPException(422, f"Invalid or corrupt media: {exc}") from exc

    asset = MediaAsset(
        project_id=project_id,
        filename=file.filename or safe_name,
        path=path,
        mime_type=declared,
        size_bytes=size,
        duration=meta.get("duration"),
        metadata_json={
            "format": meta.get("format"),
            "video": meta.get("video"),
            "audio": meta.get("audio"),
            "validated": True,
        },
        sha256=digest.hexdigest(),
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return {
        "id": asset.id,
        "filename": asset.filename,
        "size_bytes": size,
        "duration": asset.duration,
        "mime_type": asset.mime_type,
        "sha256": asset.sha256,
        "metadata": asset.metadata_json,
    }


@router.get("/project/{project_id}")
def list_media(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _owned_project(db, project_id, user)
    assets = db.query(MediaAsset).filter(MediaAsset.project_id == project_id).all()
    return [
        {"id": a.id, "filename": a.filename, "size_bytes": a.size_bytes,
         "duration": a.duration, "mime_type": a.mime_type,
         "sha256": a.sha256, "metadata": a.metadata_json or {}}
        for a in assets
    ]


@router.get("/{asset_id}/probe")
def probe_asset(asset_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    asset = db.get(MediaAsset, asset_id)
    if not asset:
        raise HTTPException(404, "Media asset not found")
    project = db.get(Project, asset.project_id)
    if not project or project.owner_id != user.id:
        raise HTTPException(404, "Media asset not found")
    if not ensure_ffmpeg():
        raise HTTPException(503, "FFmpeg/ffprobe not available")
    try:
        return probe(asset.path)
    except Exception as exc:
        raise HTTPException(500, str(exc)) from exc
