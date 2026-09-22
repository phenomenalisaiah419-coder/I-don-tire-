import os, subprocess
from pathlib import Path
import pytest
from backend.app.media_engine import ensure_ffmpeg, probe, crop, resize, reverse, delete_segment, rotate, concat

@pytest.fixture(scope='module')
def sample_video(tmp_path_factory):
    if not ensure_ffmpeg(): pytest.skip('ffmpeg unavailable')
    p=tmp_path_factory.mktemp('media')/'sample.mp4'
    r=subprocess.run(['ffmpeg','-y','-f','lavfi','-i','testsrc=size=320x240:rate=10:duration=4','-f','lavfi','-i','sine=frequency=440:duration=4','-c:v','libx264','-c:a','aac','-shortest',str(p)],capture_output=True,text=True)
    assert r.returncode==0 and p.is_file(), r.stderr[-1000:]
    return str(p)

def test_crop(sample_video,tmp_path):
    out=str(tmp_path/'crop.mp4'); crop(sample_video,out,160,120,0,0); m=probe(out); assert m['video']['width']==160 and m['video']['height']==120

def test_resize(sample_video,tmp_path):
    out=str(tmp_path/'resize.mp4'); resize(sample_video,out,640,480); m=probe(out); assert m['video']['width']==640 and m['video']['height']==480

def test_reverse(sample_video,tmp_path):
    out=str(tmp_path/'reverse.mp4'); reverse(sample_video,out); assert Path(out).is_file() and probe(out)['duration']>3

def test_delete_segment(sample_video,tmp_path):
    out=str(tmp_path/'delete.mp4'); delete_segment(sample_video,out,1,2); d=probe(out)['duration']; assert 2.5 < d < 3.5

def test_rotate(sample_video,tmp_path):
    out=str(tmp_path/'rotate.mp4'); rotate(sample_video,out,90); m=probe(out); assert m['video']['width']==240 and m['video']['height']==320
