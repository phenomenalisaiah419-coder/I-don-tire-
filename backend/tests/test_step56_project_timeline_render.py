def test_timeline_to_plan_requires_clips():
    from backend.app.services.project_timeline_render import timeline_to_plan
    class DB:
        def get(self,*a): return type("P",(),{"owner_id":1,"state_json":{"clips":[]}})()
    try:
        timeline_to_plan(DB(),1,1)
    except ValueError as e:
        assert "no clips" in str(e).lower()
    else:
        assert False

def test_timeline_plan_shape():
    # Test the pure validation shape without requiring the database.
    from backend.app.services.validated_pipeline import validate_plan
    p={"schema_version":"1.1","operations":[
        {"operation":"trim","track":"video","input_path":"/tmp/a.mp4","start":0,"end":2}
    ]}
    v=validate_plan(p,{})
    assert v["operations"][0]["operation"]=="trim"
