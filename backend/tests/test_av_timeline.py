from backend.app.av_timeline import build_av_plan

def test_audio_video_sorting():
    r=build_av_plan([
        {"operation":"volume","track":"audio","start":5},
        {"operation":"transform","track":"video","start":1,"end":4},
    ])
    assert r["operations"][0]["track"]=="video"

def test_bad_track():
    try: build_av_plan([{"operation":"x","track":"bad","start":0}]); assert False
    except ValueError: return
