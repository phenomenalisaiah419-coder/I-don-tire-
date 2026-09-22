"""Full render-pipeline contract preflight.

Runs the same validation layers used by the real renderer, but stops before
FFmpeg execution. Useful for API/CI checks and for diagnosing which gate rejects
a project.
"""
from .editplan_render_pipeline import plan_to_project
from .render_media_graph import validate_media_graph
from .render_input_preflight import validate_render_inputs
from .render_security import enforce_render_budget

def preflight_edit_plan(plan, capabilities=None):
    project=plan_to_project(plan,capabilities)
    project=validate_media_graph(project)
    project=validate_render_inputs(project)
    budget=enforce_render_budget(project)
    return {
        "status":"READY_FOR_RENDER",
        "schema_version":project["schema_version"],
        "graph":project.get("graph",{}),
        "budget":budget,
    }
