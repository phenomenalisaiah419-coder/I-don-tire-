def test_release_config_defaults(monkeypatch):
    from backend.app.services.release_config import load
    for k in list(__import__("os").environ):
        if k.startswith("PHENOVA_"):
            monkeypatch.delenv(k,raising=False)
    cfg=load()
    assert cfg.max_concurrent==1
    assert cfg.max_retries==2
    assert cfg.ffmpeg_bin=="ffmpeg"
    assert cfg.ffprobe_bin=="ffprobe"

def test_release_config_rejects_invalid_value(monkeypatch):
    from backend.app.services.release_config import load
    monkeypatch.setenv("PHENOVA_MAX_CONCURRENT_RENDERS","0")
    try: load()
    except RuntimeError as e: assert "range" in str(e)
    else: assert False
