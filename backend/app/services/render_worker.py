"""Single-concurrency persistent render worker.

The worker claims jobs atomically, reconstructs the stored plan after a restart,
runs the existing real FFmpeg progress executor, and observes persisted
cancellation state.
"""
import threading, uuid
from pathlib import Path
from datetime import datetime, timezone
from . import persistent_render_jobs as jobs
from .editplan_render_pipeline import plan_to_project
from .project_render_command import build_project_command
from .transition_render_command import build_transition_command
from .ffmpeg_progress import run_ffmpeg
from .render_verification import verify_and_publish
from .render_errors import classify
from .render_events import record

def _command(plan,output_path):
    project=plan_to_project(plan)
    videos=project["videos"]
    extra=bool(project.get("audios") or project.get("overlays") or project.get("subtitles"))
    transforms=any(any(v.get(k) for k in ("x_points","y_points","scale_points","rotation_points","opacity_points"))
                   for v in videos)
    has_transition=any(v.get("transition") for v in videos[1:])
    if has_transition and not extra and not transforms:
        return build_transition_command(videos,output_path)
    return build_project_command(project,output_path)

def run_job(job_id):
    job=jobs.get(job_id)
    if not job: raise ValueError("Render job not found")
    worker_id=str(uuid.uuid4())
    if jobs.claim(worker_id)!=job_id:
        raise RuntimeError("Render job could not be claimed")
    job=jobs.get(job_id)
    plan=job["plan"]; output_path=job["output_path"]
    cancel=threading.Event()
    stop=threading.Event()

    def watcher():
        while not stop.wait(0.5):
            jobs.heartbeat(job_id,worker_id)
            if jobs.is_cancelling(job_id):
                cancel.set(); return
    watcher_thread=threading.Thread(target=watcher,daemon=True)
    watcher_thread.start()

    try:
        cmd=_command(plan,output_path)
        temp_path=output_path+".part"
        result=run_ffmpeg(cmd,temp_path,cancel,
                          lambda p:jobs.update(job_id,progress=float(p)))
        if not result:
            raise RuntimeError("FFmpeg completed without producing an output")
        result=verify_and_publish(temp_path,output_path)
        record(job_id,"completed",{"output":result})
        record(job_id,"completed",{"output":result})
        jobs.update(job_id,status="COMPLETED",progress=100,output_path=result,
                    finished_at=datetime.now(timezone.utc).isoformat())
        return result
    except Exception as e:
        if cancel.is_set() or "cancel" in str(e).lower():
            Path(output_path).unlink(missing_ok=True)
            Path(output_path+".part").unlink(missing_ok=True)
            record(job_id,"cancelled",{})
            jobs.update(job_id,status="CANCELLED",progress=0,error="RENDER_CANCELLED",
                        finished_at=datetime.now(timezone.utc).isoformat())
            return None
        code=classify(e)
        record(job_id,"failed",{"code":code})
        jobs.update(job_id,status="FAILED",error=code,
                    finished_at=datetime.now(timezone.utc).isoformat())
        raise
    finally:
        stop.set()
        watcher_thread.join(timeout=1)

class RenderWorkerSupervisor:
    """One render worker per backend process; persistent queue prevents job loss."""
    def __init__(self, poll_seconds=1.0, stale_seconds=900):
        self.poll_seconds=poll_seconds
        self.stale_seconds=stale_seconds
        self._stop=threading.Event()
        self._thread=None

    def start(self):
        if self._thread and self._thread.is_alive(): return
        jobs.recover_stale(self.stale_seconds)
        self._stop.clear()
        self._thread=threading.Thread(target=self._loop,name="phenova-render-worker",daemon=True)
        self._thread.start()

    def stop(self):
        self._stop.set()
        if self._thread:self._thread.join(timeout=3)

    def _loop(self):
        maintenance=0
        while not self._stop.wait(self.poll_seconds):
            maintenance += 1
            if maintenance % 60 == 0:
                jobs.recover_stale()
                jobs.cleanup()
            jid=jobs.claim("supervisor")
            if not jid: continue
            try:
                # claim() has already moved it to RUNNING; run the actual process
                # without claiming it a second time.
                self._run_claimed(jid)
            except Exception:
                pass

    def _run_claimed(self,jid):
        job=jobs.get(jid)
        if not job:return
        plan=job["plan"]; output_path=job["output_path"]
        cancel=threading.Event(); stop=threading.Event()
        def watcher():
            while not stop.wait(0.5):
                jobs.heartbeat(jid,"supervisor")
                if jobs.is_cancelling(jid):cancel.set();return
        t=threading.Thread(target=watcher,daemon=True);t.start()
        try:
            temp_path=output_path+".part"
            result=run_ffmpeg(_command(plan,temp_path),temp_path,cancel,
                              lambda p:jobs.update(jid,progress=float(p)))
            if not result: raise RuntimeError("FFmpeg completed without producing an output")
            result=verify_and_publish(temp_path,output_path)
            record(jid,"completed",{"output":result})
            record(jid,"completed",{"output":result})
            jobs.update(jid,status="COMPLETED",progress=100,output_path=result,
                        finished_at=datetime.now(timezone.utc).isoformat())
        except Exception as e:
            if cancel.is_set() or "cancel" in str(e).lower():
                Path(output_path).unlink(missing_ok=True)
                Path(output_path+".part").unlink(missing_ok=True)
                record(jid,"cancelled",{})
                jobs.update(jid,status="CANCELLED",error="RENDER_CANCELLED",
                            finished_at=datetime.now(timezone.utc).isoformat())
            else:
                code=classify(e)
                record(jid,"failed",{"code":code})
                jobs.update(jid,status="FAILED",error=code,
                            finished_at=datetime.now(timezone.utc).isoformat())
        finally:
            stop.set();t.join(timeout=1)
