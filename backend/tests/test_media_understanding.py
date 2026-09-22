import shutil, subprocess
from backend.app.media_understanding import probe_streams, extract_keyframes

def make_video(path):
    ff=shutil.which("ffmpeg"); assert ff
    r=subprocess.run([ff,"-y","-f","lavfi","-i","testsrc=size=160x120:rate=5:duration=1",
                      "-pix_fmt","yuv420p",str(path)],capture_output=True)
    assert r.returncode==0

def test_probe_and_keyframes(tmp_path):
    p=tmp_path/"sample.mp4"; make_video(p)
    info=probe_streams(str(p))
    assert "streams" in info and info["streams"]
    frames=extract_keyframes(str(p),str(tmp_path/"frames"),fps=2,max_frames=3)
    assert frames and all(__import__("os").path.exists(x) for x in frames)
