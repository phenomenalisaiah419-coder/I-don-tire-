import shutil,subprocess
from backend.app.services.multitrack_renderer import render_video_with_audio

def make_media(video,audio):
    ff=shutil.which("ffmpeg"); assert ff
    r=subprocess.run([ff,"-y","-f","lavfi","-i","testsrc=size=160x120:rate=5:duration=1",
                      "-f","lavfi","-i","sine=frequency=440:duration=1",
                      "-shortest","-c:v","libx264","-pix_fmt","yuv420p","-c:a","aac",str(video)],
                     capture_output=True)
    assert r.returncode==0
    # extract a standalone audio track
    r=subprocess.run([ff,"-y","-i",str(video),"-vn","-c:a","aac",str(audio)],capture_output=True)
    assert r.returncode==0

def test_multitrack(tmp_path):
    v=tmp_path/"v.mp4"; a=tmp_path/"a.m4a"; out=tmp_path/"out.mp4"
    make_media(v,a)
    render_video_with_audio(str(v),[str(a)],str(out),160,120)
    assert out.exists() and out.stat().st_size>0
