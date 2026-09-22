import pytest

def test_graph_rejects_missing_input():
    from backend.app.services.render_media_graph import validate_media_graph
    with pytest.raises(ValueError,match="input not found"):
        validate_media_graph({"width":1920,"height":1080,
          "videos":[{"input":"/does/not/exist","start":0,"end":1}],
          "audios":[],"overlays":[],"subtitles":[]})

def test_graph_summary(tmp_path):
    from backend.app.services.render_media_graph import validate_media_graph
    p=tmp_path/"a.mp4";p.write_bytes(b"x")
    r=validate_media_graph({"width":1920,"height":1080,
       "videos":[{"input":str(p),"start":0,"end":4}],
       "audios":[],"overlays":[],"subtitles":[]})
    assert r["graph"]["duration"]==4
    assert r["graph"]["video_layers"]==1

def test_graph_rejects_invalid_timing(tmp_path):
    from backend.app.services.render_media_graph import validate_media_graph
    p=tmp_path/"a.mp4";p.write_bytes(b"x")
    with pytest.raises(ValueError):
        validate_media_graph({"videos":[{"input":str(p),"start":3,"end":2}],
                              "audios":[],"overlays":[],"subtitles":[]})
