from backend.app.timeline_engine import trim_clip, delete_range, move_clip

def test_trim_operation():
    assert trim_clip(4,1,3)=={"operation":"trim","asset_id":4,"start":1.0,"end":3.0}

def test_delete_range_operation():
    assert delete_range(4,2,5)["operation"]=="delete_range"

def test_move_operation():
    r=move_clip(4,0,1,7)
    assert r["to_track"]==1 and r["start"]==7.0

def test_invalid_range():
    try: trim_clip(1,4,2); assert False
    except ValueError: assert True
