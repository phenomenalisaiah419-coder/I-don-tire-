from backend.app.transform_keyframe_render import _expr, _points

def test_scale_points():
    p=_points([{"time":0,"value":1},{"time":2,"value":2}],"scale")
    assert _expr(p).startswith("if(lt(t,0.0)")

def test_bad_order():
    try: _points([{"time":2,"value":1},{"time":1,"value":2}],"scale"); assert False
    except ValueError: pass
