from backend.app.services.caption_render import build_ass

def test_ass_generation():
    r=build_ass([{"id":1,"start":0,"end":1.5,"text":"Hello"}],{"size":52,"bold":True})
    assert "[Events]" in r
    assert "0:00:00.00,0:00:01.50" in r
    assert "Hello" in r

def test_invalid_timing():
    try: build_ass([{"id":1,"start":2,"end":1,"text":"bad"}])
    except ValueError: return
    assert False
