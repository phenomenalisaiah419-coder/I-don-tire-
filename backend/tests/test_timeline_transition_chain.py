from backend.app.services.timeline_transition_chain import compile_chain

def test_chain():
    r=compile_chain([
        {"input":"a","start":0,"end":5},
        {"input":"b","start":4,"end":9,"transition":"dissolve","overlap":1},
        {"input":"c","start":8,"end":12,"transition":"fade","overlap":1},
    ])
    assert len(r["transitions"])==2
    assert all(x["video_audio_synced"] for x in r["transitions"])

def test_gap_rejected():
    try: compile_chain([{"start":0,"end":2},{"start":4,"end":6,"transition":"fade","overlap":1}]); assert False
    except ValueError: return
