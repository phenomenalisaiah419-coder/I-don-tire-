from backend.app.services.render_graph_executor import execute_graph

def test_rejects_unimplemented_subtitle_nodes():
    try:
        execute_graph({"nodes":[{"track":"subtitle","operation":"subtitle","input":None}]}, "/tmp/x.mp4")
        assert False
    except ValueError: return

def test_rejects_complex_video_nodes_until_supported():
    try:
        execute_graph({"nodes":[{"track":"video","operation":"crossfade","input":"x"}]}, "/tmp/x.mp4")
        assert False
    except ValueError: return
