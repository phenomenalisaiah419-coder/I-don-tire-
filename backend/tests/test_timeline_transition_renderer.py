from backend.app.services.timeline_transition_renderer import render
import tempfile, pathlib

def test_missing_clip_rejected(tmp_path):
    try: render([{"input":str(tmp_path/"missing.mp4"),"start":0,"end":1}],str(tmp_path/"o.mp4"))
    except ValueError: return
    assert False
