from backend.app.keyframe_render import interpolate

def test_interpolation():
 p=[{"time":0,"value":0},{"time":10,"value":1}]
 assert interpolate(p,5)==0.5 and interpolate(p,-1)==0 and interpolate(p,20)==1

def test_bad_order():
 try: interpolate([{"time":2,"value":1},{"time":1,"value":0}],1); assert False
 except ValueError: pass
