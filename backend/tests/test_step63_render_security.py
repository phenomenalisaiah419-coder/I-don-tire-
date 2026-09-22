import pytest

def test_path_escape_rejected(tmp_path,monkeypatch):
    from backend.app.services import render_security as r
    monkeypatch.setattr(r.settings,"media_root",str(tmp_path/"media"))
    (tmp_path/"media").mkdir()
    with pytest.raises(ValueError,match="outside"):
        r._safe_path(str(tmp_path/"other.mp4"))

def test_input_budget(tmp_path,monkeypatch):
    from backend.app.services import render_security as r
    media=tmp_path/"media"; media.mkdir()
    f=media/"a.mp4"; f.write_bytes(b"123456")
    monkeypatch.setattr(r.settings,"media_root",str(media))
    monkeypatch.setattr(r,"MAX_TOTAL_INPUT_BYTES",3)
    with pytest.raises(ValueError,match="size budget"):
        r.enforce_render_budget({"videos":[{"input":str(f)}],"audios":[],"overlays":[]})

def test_duration_budget(monkeypatch):
    from backend.app.services import render_security as r
    monkeypatch.setattr(r,"MAX_RENDER_DURATION",10)
    with pytest.raises(ValueError,match="duration budget"):
        r.enforce_render_budget({"videos":[],"audios":[],"overlays":[],
                                 "graph":{"duration":11}})
