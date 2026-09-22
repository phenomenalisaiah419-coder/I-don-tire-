import pytest

def test_missing_output_rejected(tmp_path):
    from backend.app.services.render_verification import probe_output
    with pytest.raises(RuntimeError):
        probe_output(str(tmp_path/"missing.mp4"))

def test_verify_uses_atomic_publish(tmp_path,monkeypatch):
    from backend.app.services import render_verification as rv
    temp=tmp_path/"a.part"; final=tmp_path/"a.mp4"
    temp.write_bytes(b"placeholder")
    monkeypatch.setattr(rv,"probe_output",lambda p:{"duration":10.0,"size":100,"streams":[{"codec_type":"video"}]})
    assert rv.verify_and_publish(str(temp),str(final),10)==str(final)
    assert final.exists() and not temp.exists()
