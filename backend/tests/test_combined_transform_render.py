from backend.app.services.combined_transform_render import _expr

def test_combined_expression():
    e=_expr([{"time":0,"value":0},{"time":2,"value":100}],"x",0)
    assert "between(t,0.0,2.0)" in e

def test_default_expression():
    assert _expr(None,"x",1)=="1"

def test_bad_keyframe_order():
    try:_expr([{"time":2,"value":1},{"time":1,"value":2}],"x",0);assert False
    except ValueError:return
