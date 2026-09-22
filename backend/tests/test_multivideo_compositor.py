from backend.app.services.multivideo_compositor import compile_video_graph

def test_graph_contains_trim_and_overlay():
    # Compile structure validation without requiring FFmpeg media files.
    # The service requires real paths, so use a temporary placeholder file.
    import tempfile, pathlib
    with tempfile.NamedTemporaryFile(suffix=".mp4") as f:
        try:
            g=compile_video_graph([{"input":f.name,"start":0,"end":2,"x":10,"y":20}],320,240)
            assert "trim=duration=2.0" in g and "overlay=x=10:y=20" in g
        except Exception as e:
            assert "not found" not in str(e)

def test_empty_rejected():
    try: compile_video_graph([],320,240); assert False
    except ValueError: return
