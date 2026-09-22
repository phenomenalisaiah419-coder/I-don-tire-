from backend.app.services.advanced_multivideo_compositor import _expr

def test_transform_expression():
    e=_expr([{"time":0,"value":1},{"time":2,"value":2}],1)
    assert "between(t,0.0,2.0)" in e

def test_default():
    assert _expr(None,5)=="5"
