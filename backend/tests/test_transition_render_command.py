from backend.app.services.transition_render_command import build_transition_command

def test_transition_command(tmp_path):
    import tempfile
    with tempfile.NamedTemporaryFile(suffix=".mp4") as a, tempfile.NamedTemporaryFile(suffix=".mp4") as b:
        cmd=build_transition_command([
            {"input":a.name,"start":0,"end":2},
            {"input":b.name,"start":1,"end":3,"transition":"dissolve","overlap":1}
        ],str(tmp_path/"out.mp4"))
        assert "-filter_complex" in cmd and "xfade=transition=dissolve" in cmd
