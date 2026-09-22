from backend.app.services.integrated_project_renderer import render

def test_requires_video(tmp_path):
    try: render({"videos":[]},str(tmp_path/"o.mp4"))
    except ValueError: return
    assert False

def test_transition_validation(tmp_path):
    try:
        render({"videos":[
            {"input":str(tmp_path/"a.mp4"),"start":0,"end":3},
            {"input":str(tmp_path/"b.mp4"),"start":2,"end":5,"transition":"wipe","overlap":1}
        ]},str(tmp_path/"o.mp4"))
    except ValueError as e:
        assert "Unsupported transition" in str(e)
        return
    assert False
