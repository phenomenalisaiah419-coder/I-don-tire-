"""Compile a multi-clip timeline into a chained transition sequence.

This step plans transition overlap timing deterministically. It does not fake a full
arbitrary filter graph: only adjacent clips with explicit supported transitions are
accepted by the chain compiler.
"""
SUPPORTED={"fade","dissolve"}

def compile_chain(clips:list[dict])->dict:
    if not clips: raise ValueError("At least one clip is required")
    ordered=sorted(clips,key=lambda c:float(c.get("start",0)))
    result=[]
    for i,c in enumerate(ordered):
        start=float(c["start"]); end=float(c["end"])
        if end<=start: raise ValueError("Invalid clip timing")
        result.append({**c,"start":start,"end":end})
    transitions=[]
    for i in range(len(result)-1):
        a,b=result[i],result[i+1]
        transition=b.get("transition")
        overlap=float(b.get("overlap",0))
        if transition:
            if transition not in SUPPORTED: raise ValueError("Unsupported transition")
            if overlap<=0: raise ValueError("Transition overlap must be positive")
            if overlap>=min(a["end"]-a["start"],b["end"]-b["start"]):
                raise ValueError("Transition overlap is too long for one clip")
            if float(b["start"])>float(a["end"]):
                raise ValueError("Transition clips must touch or overlap")
            transitions.append({
                "from":i,"to":i+1,"type":transition,
                "overlap":overlap,"video_audio_synced":True
            })
    return {"schema_version":"1.0","clips":result,"transitions":transitions}
