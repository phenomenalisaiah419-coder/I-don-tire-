"""Compile a validated AV timeline into a deterministic render graph.

This compiler creates structured FFmpeg graph instructions; it does not execute them.
"""
TRACKS={"video","audio","overlay","subtitle"}

def compile_graph(plan:dict)->dict:
    if not isinstance(plan,dict) or plan.get("schema_version")!="1.0":
        raise ValueError("Unsupported timeline plan")
    ops=plan.get("operations")
    if not isinstance(ops,list): raise ValueError("Operations must be a list")

    checked=[]
    for op in ops:
        if not isinstance(op,dict): raise ValueError("Operation must be an object")
        track=op.get("track")
        if track not in TRACKS: raise ValueError(f"Unsupported track: {track}")
        start=float(op.get("start",0))
        end=op.get("end")
        if start<0 or (end is not None and float(end)<=start):
            raise ValueError("Invalid timeline range")
        checked.append({**op,"start":start,"end":None if end is None else float(end)})

    checked.sort(key=lambda x:(x["start"],x["track"]))
    nodes=[]
    for i,op in enumerate(checked):
        nodes.append({
            "node_id":f"node_{i}",
            "track":op["track"],
            "operation":op["operation"],
            "start":op["start"],
            "end":op["end"],
            "input":op.get("input_path"),
            "output":op.get("output_path"),
        })

    return {
        "schema_version":"1.0",
        "graph_version":"1.0",
        "nodes":nodes,
        "video_nodes":[n for n in nodes if n["track"] in {"video","overlay"}],
        "audio_nodes":[n for n in nodes if n["track"]=="audio"],
        "subtitle_nodes":[n for n in nodes if n["track"]=="subtitle"],
    }
