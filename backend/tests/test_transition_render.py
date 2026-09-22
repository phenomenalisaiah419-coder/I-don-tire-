import shutil, subprocess
from backend.app.transition_render import crossfade,dissolve

def make_video(path, color):
    ff=shutil.which("ffmpeg"); assert ff
    r=subprocess.run([ff,"-y","-f","lavfi","-i",f"color=c={color}:s=160x120:r=10:d=1",
                      "-f","lavfi","-i","anullsrc=r=44100:cl=mono","-t","1",
                      "-shortest","-c:v","libx264","-pix_fmt","yuv420p","-c:a","aac",str(path)],
                     capture_output=True)
    assert r.returncode==0

def test_crossfade_and_dissolve(tmp_path):
    a=tmp_path/"a.mp4"; b=tmp_path/"b.mp4"; x=tmp_path/"x.mp4"; d=tmp_path/"d.mp4"
    make_video(a,"red"); make_video(b,"blue")
    crossfade(str(a),str(b),str(x),.3,.7)
    dissolve(str(a),str(b),str(d),.3,.7)
    assert x.exists() and x.stat().st_size>0
    assert d.exists() and d.stat().st_size>0
