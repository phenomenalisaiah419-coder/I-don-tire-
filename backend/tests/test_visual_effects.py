import shutil, subprocess
from backend.app.visual_effects import scale, crop, rotate

def make_video(path):
    ff=shutil.which("ffmpeg"); assert ff
    r=subprocess.run([ff,"-y","-f","lavfi","-i","testsrc=size=320x240:rate=5:duration=0.5",
                      "-pix_fmt","yuv420p",str(path)],capture_output=True)
    assert r.returncode==0

def test_scale_crop_rotate(tmp_path):
    src=tmp_path/"in.mp4"; make_video(src)
    a=tmp_path/"scale.mp4"; b=tmp_path/"crop.mp4"; c=tmp_path/"rot.mp4"
    scale(str(src),str(a),160,120)
    crop(str(src),str(b),160,120)
    rotate(str(src),str(c),90)
    assert all(p.exists() and p.stat().st_size>0 for p in [a,b,c])
