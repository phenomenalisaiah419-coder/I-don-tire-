import pytest

def test_preflight_rejects_missing_media(tmp_path):
    from backend.app.services.render_pipeline_preflight import preflight_edit_plan
    with pytest.raises(ValueError):
        preflight_edit_plan({"schema_version":"1.0","operations":[
            {"operation":"trim","track":"video","input_path":str(tmp_path/"missing.mp4"),
             "start":0,"end":2}
        ]})

def test_preflight_passes_all_non_ffmpeg_gates(tmp_path,monkeypatch):
    from backend.app.services import render_pipeline_preflight as pf
    media=tmp_path/"media";media.mkdir()
    video=media/"video.mp4";video.write_bytes(b"fixture")
    monkeypatch.setattr(
        "backend.app.services.render_input_preflight.probe_media",
        lambda _: {"path":str(video),"size":7,"duration":2.0,
                   "format":"mp4","streams":[{"codec_type":"video","codec_name":"h264"}]}
    )
    monkeypatch.setattr("backend.app.services.render_security._media_root",lambda:media)
    result=pf.preflight_edit_plan({"schema_version":"1.0","operations":[
        {"operation":"trim","track":"video","input_path":str(video),"start":0,"end":2}
    ]})
    assert result["status"]=="READY_FOR_RENDER"
    assert result["graph"]["duration"]==2.0

def test_preflight_is_deterministic(tmp_path,monkeypatch):
    from backend.app.services import render_pipeline_preflight as pf
    media=tmp_path/"media";media.mkdir()
    video=media/"video.mp4";video.write_bytes(b"fixture")
    fake={"path":str(video),"size":7,"duration":3.0,"format":"mp4",
          "streams":[{"codec_type":"video"}]}
    monkeypatch.setattr(
        "backend.app.services.render_input_preflight.probe_media",lambda _:fake
    )
    monkeypatch.setattr("backend.app.services.render_security._media_root",lambda:media)
    plan={"schema_version":"1.0","operations":[
        {"operation":"trim","track":"video","input_path":str(video),"start":0,"end":3}
    ]}
    assert pf.preflight_edit_plan(plan)==pf.preflight_edit_plan(plan)
