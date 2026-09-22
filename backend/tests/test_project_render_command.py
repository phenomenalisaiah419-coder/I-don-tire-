from backend.app.services.project_render_command import build_project_command

def test_full_command():
    import tempfile
    with tempfile.NamedTemporaryFile(suffix=".mp4") as v, tempfile.NamedTemporaryFile(suffix=".srt") as s:
        p={"videos":[{"input":v.name,"start":0,"end":2}],
           "subtitles":[{"input":s.name}]}
        cmd=build_project_command(p,"/tmp/out.mp4")
        assert "-filter_complex" in cmd and cmd[-1]=="/tmp/out.mp4"

def test_no_video():
    try: build_project_command({}, "/tmp/o.mp4")
    except ValueError: return
    assert False
