from backend.app.services.captions import to_srt,to_vtt,split_for_display

def test_srt_generation():
    r=to_srt([{"id":1,"start":0,"end":1.25,"text":"Hello world"}])
    assert "00:00:00,000 --> 00:00:01,250" in r

def test_vtt_generation():
    r=to_vtt([{"id":1,"start":1,"end":2,"text":"Hello"}])
    assert r.startswith("WEBVTT") and "00:00:01.000 --> 00:00:02.000" in r

def test_display_lines():
    assert len(split_for_display("one two three four",7))>1
