"""Single controlled execution boundary for PHENOVA editing.

Only validated, registered operations reach real renderers. Structural timeline
operations are returned as canonical state changes; media operations execute
through the existing real FFmpeg primitives.
"""
from .combined_transform_render import render as render_transform
from .transition_render import crossfade, dissolve, overlay_layer
from .visual_effects import scale, crop, rotate, opacity_overlay, fade
from .audio_engine import mute, set_volume, audio_fade, change_speed, mix_tracks
from ..media_engine import trim, concat, execute_operation as legacy_execute

def execute_operation(op:dict)->dict:
    if not isinstance(op,dict):
        raise ValueError("Operation must be an object")
    name=op.get("operation")
    out=op.get("output_path")
    inp=op.get("input_path")

    if name in {"delete","reorder","move_clip","split"}:
        # These are canonical timeline transformations. Rendering is performed
        # by the project renderer once the complete plan is compiled.
        return {"status":"PLANNED","operation":name,"timeline_change":op}

    if name in {"trim","cut"}:
        if not inp or not out: raise ValueError("Trim requires input_path/output_path")
        start=float(op["start"]); end=float(op["end"])
        return {"status":"COMPLETED","output_path":trim(inp,out,start,end)}

    if name=="concat":
        paths=op.get("input_paths")
        if not paths or not out: raise ValueError("Concat requires input_paths/output_path")
        return {"status":"COMPLETED","output_path":concat(paths,out)}

    if name=="transform":
        if not inp or not out: raise ValueError("Transform requires input_path/output_path")
        return {"status":"COMPLETED","output_path":render_transform(
            inp,out,op.get("canvas_width",1920),op.get("canvas_height",1080),
            op.get("x_points"),op.get("y_points"),op.get("scale_points"),
            op.get("rotation_points"),op.get("opacity_points"))}

    if name=="crossfade":
        return {"status":"COMPLETED","output_path":crossfade(
            op["first_path"],op["second_path"],out,op.get("duration",1.0),op.get("offset",0.0))}
    if name=="dissolve":
        return {"status":"COMPLETED","output_path":dissolve(
            op["first_path"],op["second_path"],out,op.get("duration",1.0),op.get("offset",0.0))}
    if name=="overlay":
        return {"status":"COMPLETED","output_path":overlay_layer(
            op["base_path"],op["overlay_path"],out,op.get("x",0),op.get("y",0),op.get("opacity",1.0))}
    if name in {"scale","resize"}:
        return {"status":"COMPLETED","output_path":scale(inp,out,op["width"],op["height"])}
    if name=="crop":
        return {"status":"COMPLETED","output_path":crop(inp,out,op["width"],op["height"],op.get("x",0),op.get("y",0))}
    if name=="rotate":
        return {"status":"COMPLETED","output_path":rotate(inp,out,op["degrees"])}
    if name=="opacity_overlay":
        return {"status":"COMPLETED","output_path":opacity_overlay(
            op["base_path"],op["overlay_path"],out,op.get("opacity",1.0),op.get("x",0),op.get("y",0))}
    if name=="fade":
        return {"status":"COMPLETED","output_path":fade(
            inp,out,op.get("fade_in",0),op.get("fade_out",0),op.get("duration"))}
    if name=="mute":
        return {"status":"COMPLETED","output_path":mute(inp,out,op.get("start",0),op.get("end"))}
    if name=="volume":
        return {"status":"COMPLETED","output_path":set_volume(inp,out,op.get("volume",1.0))}
    if name=="audio_fade":
        return {"status":"COMPLETED","output_path":audio_fade(
            inp,out,op.get("fade_in",0),op.get("fade_out",0),op.get("duration"))}
    if name in {"audio_speed","speed"}:
        return {"status":"COMPLETED","output_path":change_speed(inp,out,op.get("speed",1.0))}
    if name=="mix_audio":
        return {"status":"COMPLETED","output_path":mix_tracks(
            op["input_paths"],out,op.get("weights"))}
    if name=="reverse":
        # Use the already-tested media-engine dispatcher for this operation.
        return {"status":"COMPLETED","output_path":legacy_execute("reverse",inp,out,op.get("params",{}))}
    raise ValueError(f"Unsupported canonical operation: {name}")
