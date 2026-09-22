import pytest

def test_compile_render_plan_is_deterministic():
    from backend.app.services.render_plan_compiler import compile_render_plan
    p={"schema_version":"1.0","operations":[
        {"operation":"trim","track":"video","input_path":"/server/a.mp4","start":1,"end":4},
        {"operation":"volume","track":"audio","input_path":"/server/a.wav","start":0,"end":3,"volume":0.8}
    ]}
    r=compile_render_plan(p)
    assert r["schema_version"]=="2.0"
    assert r["videos"][0]["start"]==1.0
    assert r["audios"][0]["volume"]==0.8

def test_structural_operation_cannot_enter_renderer():
    from backend.app.services.render_plan_compiler import compile_render_plan
    with pytest.raises(ValueError,match="Structural"):
        compile_render_plan({"schema_version":"1.0","operations":[
            {"operation":"delete","asset_id":1,"start":1,"end":2}
        ]})

def test_invalid_dimensions_rejected():
    from backend.app.services.render_plan_compiler import validate_render_plan
    with pytest.raises(ValueError):
        validate_render_plan({"schema_version":"2.0","width":0,"height":1080,
                              "videos":[{}],"audios":[],"overlays":[],"subtitles":[]})
