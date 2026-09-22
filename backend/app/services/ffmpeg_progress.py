"""FFmpeg subprocess runner with real progress telemetry and cancellation."""
from pathlib import Path
import subprocess, threading

def run_ffmpeg(args, output_path, cancel_event, on_progress=None):
    if not args or not str(args[0]).endswith("ffmpeg"):
        raise ValueError("FFmpeg command must begin with ffmpeg")
    cmd=list(args[:1])+["-progress","pipe:1","-nostats"]+list(args[1:])
    proc=subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                          text=True, bufsize=1)
    duration_us=None; last=-1
    try:
        while True:
            if cancel_event.is_set():
                proc.terminate()
                try: proc.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    proc.kill(); proc.wait()
                raise RuntimeError("Render cancelled")
            line=proc.stdout.readline() if proc.stdout else ""
            if line:
                k,_,v=line.strip().partition("=")
                if k=="duration_us":
                    try: duration_us=int(v)
                    except ValueError: pass
                elif k=="out_time_us" and duration_us:
                    try:
                        pct=max(0,min(99,int(int(v)*100/duration_us)))
                        if pct!=last:
                            last=pct
                            if on_progress: on_progress(pct)
                    except ValueError: pass
            elif proc.poll() is not None:
                break
        err=proc.stderr.read() if proc.stderr else ""
        if proc.returncode != 0:
            raise RuntimeError(err[-8000:] or "FFmpeg failed")
        if not Path(output_path).exists() or Path(output_path).stat().st_size==0:
            raise RuntimeError("FFmpeg completed without a verified output")
        if on_progress: on_progress(100)
        return output_path
    finally:
        if proc.poll() is None:
            proc.kill(); proc.wait()
