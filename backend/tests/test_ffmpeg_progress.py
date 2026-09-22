import shutil, threading
from backend.app.services.ffmpeg_progress import run_ffmpeg

def test_real_progress(tmp_path):
    ff=shutil.which("ffmpeg"); assert ff
    out=tmp_path/"out.mp4"; seen=[]
    run_ffmpeg([ff,"-y","-f","lavfi","-i","testsrc=size=64x64:rate=5:duration=1",
                "-c:v","libx264","-pix_fmt","yuv420p",str(out)],
               str(out),threading.Event(),seen.append)
    assert out.exists() and out.stat().st_size>0 and seen[-1]==100

def test_cancel(tmp_path):
    ff=shutil.which("ffmpeg"); assert ff
    ev=threading.Event(); ev.set()
    try:
        run_ffmpeg([ff,"-y","-f","lavfi","-i","testsrc=duration=1",
                    "-c:v","libx264",str(tmp_path/"o.mp4")],
                   str(tmp_path/"o.mp4"),ev)
        assert False
    except RuntimeError as e:
        assert "cancelled" in str(e)
