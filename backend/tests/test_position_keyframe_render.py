from backend.app.position_keyframe_render import _expr,_points

def test_position_expression():
    p=_points([{"time":0,"value":0},{"time":2,"value":100}],"x")
    assert _expr(p).startswith("if(lt(t,0.0)")

def test_bad_order():
    try:_points([{"time":2,"value":1},{"time":1,"value":2}],"x");assert False
    except ValueError:return
