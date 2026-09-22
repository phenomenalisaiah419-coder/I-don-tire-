"""Unified PHENOVA project renderer.

Single project-level entry point. It validates the project shape, selects the
verified sequential transition renderer when appropriate, and otherwise uses
the integrated compositor. It never silently falls back from a requested
transition to a plain concatenation.
"""
from pathlib import Path
from .integrated_project_renderer import render as integrated_render
from .render_media_graph import validate_media_graph
from .render_input_preflight import validate_render_inputs
from .render_security import enforce_render_budget, validate_render_output_path
from .transition_aware_compositor import render as transition_render

def render(project:dict, output_path:str)->str:
    project=validate_media_graph(project)
    project=validate_render_inputs(project)
    enforce_render_budget(project)
    output_path=validate_render_output_path(output_path)
    videos=sorted(project.get("videos",[]),key=lambda x:float(x.get("start",0)))
    if not videos: raise ValueError("At least one video clip is required")

    has_transitions=any(v.get("transition") for v in videos[1:])
    has_extra_layers=bool(project.get("audios") or project.get("overlays") or project.get("subtitles"))
    has_transforms=any(any(v.get(k) for k in (
        "x_points","y_points","scale_points","rotation_points","opacity_points"))
        for v in videos)

    # Transition renderer is used only for the verified sequential full-frame case.
    # If the project has additional layers/transforms, keep it in the integrated
    # path rather than silently dropping those features.
    if has_transitions and not has_extra_layers and not has_transforms:
        return transition_render(videos,output_path)
    return integrated_render(project,output_path)
