from backend.app.audio_engine import set_volume,audio_fade,change_speed
import shutil,subprocess

def make_video(path):
    ff=shutil.which("ffmpeg"); assert ff
    r=subprocess.run([ff,"-y","-f","lavfi","-i","testsrc=size=160x120:rate=5:duration=1",
                      "-f","lavfi","-i","sine=frequency=440:duration=1",
                      "-shortest","-c:v","libx264","-pix_fmt","yuv420p","-c:a","aac",str(path)],
                     capture_output=True)
    assert r.returncode==0

def test_audio_operations(tmp_path):
    src=tmp_path/"in.mp4"; make_video(src)
    for fn,name,args in [(set_volume,"v.mp4",(0.5,)),(audio_fade,"f.mp4",(0.2,0.2,1.0)),(change_speed,"s.mp4",(1.5,))]:
        out=tmp_path/name; fn(str(src),str(out),*args); assert out.exists() and out.stat().st_size>0
