from backend.app.services.overlap_transition_renderer import render
import shutil,subprocess

def make(path,color):
    ff=shutil.which("ffmpeg"); assert ff
    r=subprocess.run([ff,"-y","-f","lavfi","-i",f"color=c={color}:s=160x120:r=10:d=1",
                      "-f","lavfi","-i","sine=frequency=440:duration=1",
                      "-shortest","-c:v","libx264","-pix_fmt","yuv420p","-c:a","aac",str(path)],
                     capture_output=True)
    assert r.returncode==0

def test_overlap_transition(tmp_path):
    a=tmp_path/"a.mp4"; b=tmp_path/"b.mp4"; o=tmp_path/"o.mp4"
    make(a,"red"); make(b,"blue")
    render(str(a),str(b),str(o),"dissolve",.5)
    assert o.exists() and o.stat().st_size>0

def test_invalid_transition():
    try: render("/a","/b","/o","wipe",1)
    except ValueError: return
    assert False
