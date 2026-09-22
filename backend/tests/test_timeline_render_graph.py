from backend.app.services.timeline_render_graph import compile_graph

def test_graph_compiles_and_sorts():
    plan={"schema_version":"1.0","operations":[
        {"operation":"volume","track":"audio","start":3,"end":5},
        {"operation":"transform","track":"video","start":0,"end":4},
        {"operation":"subtitle","track":"subtitle","start":1,"end":2},
    ]}
    g=compile_graph(plan)
    assert g["nodes"][0]["track"]=="video"
    assert len(g["audio_nodes"])==1
    assert len(g["subtitle_nodes"])==1

def test_bad_track_rejected():
    try: compile_graph({"schema_version":"1.0","operations":[{"operation":"x","track":"fx","start":0}]})
    except ValueError: return
    assert False
