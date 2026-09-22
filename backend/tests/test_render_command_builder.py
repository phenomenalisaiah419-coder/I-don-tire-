from backend.app.services.render_command_builder import build_basic_project_command

def test_basic_command():
    import tempfile, pathlib
    with tempfile.NamedTemporaryFile(suffix=".mp4") as f:
        cmd=build_basic_project_command({"videos":[{"input":f.name,"start":0,"end":1}]},
                                        "/tmp/out.mp4")
        assert "-map" in cmd and cmd[-1]=="/tmp/out.mp4"
