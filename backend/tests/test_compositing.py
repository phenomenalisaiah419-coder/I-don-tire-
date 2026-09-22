from backend.app.compositing import transition,layer,keyframes

def test_transition():
    assert transition("dissolve",.5)["type"]=="dissolve"

def test_layer():
    assert layer(2,1,0,5,.8)["opacity"]==.8

def test_keyframes():
    r=keyframes("opacity",[{"time":0,"value":0},{"time":2,"value":1}])
    assert len(r["points"])==2

def test_bad_keyframes():
    try:keyframes("x",[{"time":2,"value":1},{"time":1,"value":0}]);assert False
    except ValueError:return
