import os, subprocess, tempfile
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import Project, MediaAsset, Transcript, MediaAnalysis, User
from ..schemas import TranscriptRequest, TranscriptUpdate, AnalysisRequest
from ..security import get_current_user
from ..transcription import get_transcription_provider

router = APIRouter()

def owned_asset(db, asset_id, user_id):
    asset = db.get(MediaAsset, asset_id)
    if not asset:
        raise HTTPException(404, 'Media asset not found')
    project = db.get(Project, asset.project_id)
    if not project or project.owner_id != user_id:
        raise HTTPException(404, 'Media asset not found')
    return project, asset

@router.post('/transcripts')
async def create_transcript(body: TranscriptRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project, asset = owned_asset(db, body.asset_id, user.id)
    if not asset.mime_type.startswith(('video/', 'audio/')):
        raise HTTPException(415, 'Asset has no supported audio stream')
    fd, wav = tempfile.mkstemp(suffix='.wav'); os.close(fd)
    try:
        cmd = ['ffmpeg','-y','-i',asset.path,'-vn','-ac','1','-ar','16000','-c:a','pcm_s16le',wav]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode != 0:
            raise HTTPException(422, 'Unable to extract audio for transcription')
        try:
            result = await get_transcription_provider().transcribe(wav, body.language)
        except Exception as exc:
            raise HTTPException(503, f'Transcription unavailable: {exc}') from exc
        segments = result.get('segments') or []
        text = result.get('text') or ' '.join(str(s.get('text','')).strip() for s in segments).strip()
        t = Transcript(project_id=project.id, asset_id=asset.id, language=body.language,
                       status='READY', provider='configured-provider', text=text,
                       segments_json=segments)
        db.add(t); db.commit(); db.refresh(t)
        return {'id':t.id,'asset_id':asset.id,'status':t.status,'text':t.text,'segments':segments}
    finally:
        if os.path.exists(wav): os.remove(wav)

@router.get('/transcripts/{asset_id}')
def get_transcript(asset_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project, asset = owned_asset(db, asset_id, user.id)
    t = db.query(Transcript).filter(Transcript.asset_id == asset.id).order_by(Transcript.id.desc()).first()
    if not t: raise HTTPException(404, 'Transcript not found')
    return {'id':t.id,'asset_id':t.asset_id,'language':t.language,'status':t.status,'text':t.text,'segments':t.segments_json}

@router.put('/transcripts/{transcript_id}')
def update_transcript(transcript_id: int, body: TranscriptUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    t = db.get(Transcript, transcript_id)
    if not t: raise HTTPException(404, 'Transcript not found')
    project = db.get(Project, t.project_id)
    if not project or project.owner_id != user.id: raise HTTPException(404, 'Transcript not found')
    t.text = body.text; t.segments_json = body.segments; t.provider = 'user-edited'
    db.commit()
    return {'id':t.id,'status':t.status,'text':t.text,'segments':t.segments_json}

@router.post('/analysis')
def analyze_asset(body: AnalysisRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project, asset = owned_asset(db, body.asset_id, user.id)
    allowed = {'metadata','audio','duration','quality'}
    requested = [x for x in body.analysis_types if x in allowed]
    if not requested: raise HTTPException(400, 'No supported analysis types requested')
    result = {'asset_id':asset.id,'metadata':asset.metadata_json or {},'duration':asset.duration,'mime_type':asset.mime_type,'size_bytes':asset.size_bytes}
    if 'audio' in requested:
        result['audio'] = {k:v for k,v in (asset.metadata_json or {}).items() if k in {'audio_codec','sample_rate','channels'}}
    a = MediaAnalysis(project_id=project.id, asset_id=asset.id, analysis_type=','.join(requested), result_json=result)
    db.add(a); db.commit(); db.refresh(a)
    return {'id':a.id,'status':a.status,'result':result}
