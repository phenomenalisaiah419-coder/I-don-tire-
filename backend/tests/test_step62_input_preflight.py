import pytest

def test_missing_input_fails_before_render():
    from backend.app.services.render_input_preflight import validate_render_inputs
    with pytest.raises(ValueError,match="missing"):
        validate_render_inputs({"videos":[{"input":"/missing/a.mp4"}]})

def test_wrong_stream_role_fails(monkeypatch,tmp_path):
    from backend.app.services import render_input_preflight as p
    f=tmp_path/"a.mp4";f.write_bytes(b"x")
    monkeypatch.setattr(p,"probe_media",lambda _:{"duration":2,"streams":[{"codec_type":"audio"}]})
    with pytest.raises(ValueError,match="required video"):
        p.validate_render_inputs({"videos":[{"input":str(f)}]})
