"""Render jobs using one real FFmpeg progress/cancellation executor."""
from pathlib import Path
from threading import Lock, Event
from uuid import uuid4

_jobs={}; _events={}; _lock=Lock()

def create_job(plan, output_path, capabilities=None):
    jid=str(uuid4())
    with _lock:
        _jobs[jid]={"id":jid,"status":"QUEUED","progress":0,
                    "output_path":output_path,"error":None}
        _events[jid]=Event()
    return jid

def get_job(job_id):
    with _lock:return dict(_jobs[job_id]) if job_id in _jobs else None

def cancel_job(job_id):
    with _lock:
        if job_id not in _jobs: raise ValueError("Render job not found")
        if _jobs[job_id]["status"] in {"COMPLETED","FAILED","CANCELLED"}: return False
        _jobs[job_id]["status"]="CANCELLING"; _events[job_id].set(); return True

def _set(jid,**kw):
    with _lock:
        if jid in _jobs:_jobs[jid].update(kw)

def run_job(jid,plan,output_path,capabilities=None):
    from .editplan_render_pipeline import plan_to_project
    from .project_render_command import build_project_command
    from .transition_render_command import build_transition_command
    from .ffmpeg_progress import run_ffmpeg
    try:
        _set(jid,status="RUNNING",progress=0)
        if isinstance(plan,dict) and not plan.get("operations"):
            from .render_job_noop import render_noop
            result=render_noop(output_path)
            _set(jid,status="COMPLETED",progress=100,output_path=result)
            return result
        project=plan_to_project(plan)
        videos=project["videos"]
        # Use transition-specific command only when the project is a pure sequential
        # full-frame transition project. Otherwise use the integrated graph.
        extra=bool(project.get("audios") or project.get("overlays") or project.get("subtitles"))
        transforms=any(any(v.get(k) for k in ("x_points","y_points","scale_points","rotation_points","opacity_points")) for v in videos)
        has_transition=any(v.get("transition") for v in videos[1:])
        cmd=(build_transition_command(videos,output_path)
             if has_transition and not extra and not transforms
             else build_project_command(project,output_path))
        result=run_ffmpeg(cmd,output_path,_events[jid],lambda p:_set(jid,progress=p))
        _set(jid,status="COMPLETED",progress=100,output_path=result)
        return result
    except RuntimeError as e:
        if "cancelled" in str(e).lower() or _events.get(jid,Event()).is_set():
            Path(output_path).unlink(missing_ok=True)
            _set(jid,status="CANCELLED",progress=0,error="Render cancelled")
            return None
        _set(jid,status="FAILED",error=str(e)); raise
    except Exception as e:
        _set(jid,status="FAILED",error=str(e)); raise
    finally:
        with _lock:_events.pop(jid,None)

def render_edit_plan(plan, output_path, capabilities=None):
    """Compatibility entry point that creates and runs a real render job."""
    jid=create_job(plan,output_path,capabilities)
    return run_job(jid,plan,output_path,capabilities)
