import pytest

def test_trim_split_delete_reducer():
    from backend.app.services.canonical_timeline import apply_operations
    state={"clips":[{"id":1,"start":0,"duration":10,"track_id":"video"}]}
    s=apply_operations(state,[{"operation":"trim","asset_id":1,"start":2,"end":8}])
    assert s["clips"][0]["duration"]==6
    s=apply_operations(s,[{"operation":"split","asset_id":1,"at":2}])
    assert len(s["clips"])==2
    s=apply_operations(s,[{"operation":"delete","asset_id":1,"start":0,"end":1}])
    assert s["clips"][0]["duration"]==1

def test_reorder():
    from backend.app.services.canonical_timeline import apply_operation
    state={"clips":[{"id":1,"start":0,"duration":5,"track_id":"video"}]}
    s=apply_operation(state,{"operation":"reorder","asset_id":1,"to_track":"audio","start":4})
    assert s["clips"][0]["track_id"]=="audio"
    assert s["clips"][0]["start"]==4

def test_versioned_snapshot(tmp_path,monkeypatch):
    from backend.app.services import timeline_snapshot as ts
    monkeypatch.setattr(ts,"DB_PATH",str(tmp_path/"timeline.sqlite"))
    v1=ts.save(1,{"clips":[]})
    v2=ts.save(1,{"clips":[{"id":1,"start":0,"duration":2}]})
    assert (v1,v2)==(1,2)
    assert ts.latest(1)["version"]==2
