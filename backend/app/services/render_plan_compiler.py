"""Canonical Edit Plan -> deterministic Render Plan compiler.

The compiler produces an immutable, renderer-facing representation. It does not
execute FFmpeg and does not accept arbitrary client filesystem paths as authority;
callers must resolve paths from owned media records before compilation.
"""
from copy import deepcopy
from .validated_pipeline import validate_plan

RENDER_SCHEMA="2.0"
VIDEO_OPS={"trim","cut","transform","scale","resize","crop","rotate","fade","crossfade","dissolve","overlay"}
AUDIO_OPS={"volume","mute","audio_fade","audio_speed","speed","mix_audio"}
STRUCTURAL={"delete","reorder","split"}

def compile_render_plan(plan, capabilities=None):
    validated=validate_plan(plan,capabilities)
    videos=[]; audios=[]; overlays=[]; subtitles=[]

    for raw in validated["operations"]:
        op=deepcopy(raw); name=op["operation"]; track=op.get("track","video")
        if name in STRUCTURAL:
            raise ValueError("Structural timeline operations must be resolved before rendering")

        if track=="video":
            if name not in VIDEO_OPS: raise ValueError(f"Unsupported video render operation: {name}")
            inp=op.get("input_path")
            if not inp: raise ValueError(f"{name} requires input_path")
            start=float(op.get("start",0))
            end=op.get("end")
            if end is None:
                duration=op.get("duration")
                if duration is None: raise ValueError(f"{name} requires end or duration")
                end=start+float(duration)
            if end<=start: raise ValueError("Render range must have positive duration")
            node={"input":str(inp),"start":start,"end":float(end),"operation":name}
            for k in ("x","y","x_points","y_points","scale_points",
                      "rotation_points","opacity_points","transition","overlap"):
                if k in op: node[k]=op[k]
            videos.append(node)

        elif track=="audio":
            if name not in AUDIO_OPS: raise ValueError(f"Unsupported audio operation: {name}")
            inp=op.get("input_path")
            if not inp: raise ValueError(f"{name} requires input_path")
            start=float(op.get("start",0)); end=op.get("end")
            node={"input":str(inp),"start":start,"end":float(end) if end is not None else None,
                  "operation":name}
            for k in ("volume","speed","fade_in","fade_out","weights"):
                if k in op: node[k]=op[k]
            audios.append(node)

        elif track=="overlay":
            inp=op.get("input_path")
            if not inp: raise ValueError("Overlay requires input_path")
            node={"input":str(inp),"start":float(op.get("start",0)),
                  "end":float(op.get("end",1)),"x":int(op.get("x",0)),
                  "y":int(op.get("y",0)),"operation":name}
            for k in ("opacity","x_points","y_points","opacity_points"):
                if k in op: node[k]=op[k]
            overlays.append(node)

        elif track=="subtitle":
            inp=op.get("input_path")
            if not inp: raise ValueError("Subtitle requires input_path")
            subtitles.append({"input":str(inp),"operation":name})

        else:
            raise ValueError(f"Unsupported render track: {track}")

    if not videos: raise ValueError("Render Plan contains no video operations")
    if len(subtitles)>1: raise ValueError("Only one subtitle track is currently supported")

    return {"schema_version":RENDER_SCHEMA,
            "width":int(plan.get("width",1920)),
            "height":int(plan.get("height",1080)),
            "videos":videos,"audios":audios,"overlays":overlays,"subtitles":subtitles}

def validate_render_plan(render_plan):
    if not isinstance(render_plan,dict) or render_plan.get("schema_version")!=RENDER_SCHEMA:
        raise ValueError("Unsupported Render Plan schema")
    if not render_plan.get("videos"): raise ValueError("Render Plan has no video")
    for group in ("videos","audios","overlays","subtitles"):
        if not isinstance(render_plan.get(group),list): raise ValueError(f"{group} must be a list")
    if render_plan["width"]<=0 or render_plan["height"]<=0:
        raise ValueError("Invalid render dimensions")
    return render_plan
