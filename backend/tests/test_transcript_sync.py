from backend.app.services.transcript_sync import segment_to_operation, sync_change

def test_transcript_remove_maps_to_timeline():
    s={"id":5,"asset_id":9,"start":2,"end":4}
    r=segment_to_operation(s,"remove")
    assert r["operation"]=="delete_range"
    assert r["segment_id"]==5 and r["start"]==2.0

def test_transcript_timing_change_syncs():
    r=sync_change({"id":5,"asset_id":9,"start":2,"end":4},3,5)
    assert r["timeline"]["start"]==3.0 and r["timeline"]["end"]==5.0

def test_bad_segment_rejected():
    try: segment_to_operation({"id":1,"start":5,"end":2})
    except ValueError: return
    assert False
