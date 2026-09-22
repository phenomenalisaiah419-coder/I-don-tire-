from backend.app.services.project_renderer import render

def test_project_requires_video(tmp_path):
    try: render({"videos":[]},str(tmp_path/"o.mp4"))
    except ValueError: return
    assert False

def test_missing_input_rejected(tmp_path):
    try: render({"videos":[{"input":str(tmp_path/"x.mp4"),"start":0,"end":1}]},str(tmp_path/"o.mp4"))
    except ValueError: return
    assert False
