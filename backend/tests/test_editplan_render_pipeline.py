from backend.app.services.editplan_render_pipeline import plan_to_project

def test_plan_to_project():
    p={"schema_version":"1.0","operations":[
        {"operation":"transform","track":"video","input_path":"a.mp4","start":0,"end":3},
        {"operation":"volume","track":"audio","input_path":"a.mp4","start":0},
        {"operation":"subtitle","track":"subtitle","input_path":"captions.srt","start":0,"end":3},
    ]}
    r=plan_to_project(p)
    assert len(r["videos"])==1 and len(r["audios"])==1 and len(r["subtitles"])==1

def test_unsupported_operation():
    try: plan_to_project({"operations":[{"operation":"magic","track":"video","input_path":"x"}]})
    except ValueError: return
    assert False
