from backend.app.services.transition_aware_compositor import render

def test_missing_input_rejected(tmp_path):
    try: render([{"input":str(tmp_path/"a.mp4"),"start":0,"end":1}],str(tmp_path/"o.mp4"))
    except ValueError: return
    assert False

def test_bad_transition_rejected(tmp_path):
    try:
        render([
            {"input":str(tmp_path/"a.mp4"),"start":0,"end":2},
            {"input":str(tmp_path/"b.mp4"),"start":1,"end":3,"transition":"wipe","overlap":1}
        ],str(tmp_path/"o.mp4"))
    except ValueError as e:
        assert "Unsupported transition" in str(e)
        return
    assert False
