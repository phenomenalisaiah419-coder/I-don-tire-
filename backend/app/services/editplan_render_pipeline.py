"""Edit Plan rendering facade."""
from .validated_pipeline import validate_plan
from .render_plan_compiler import compile_render_plan, validate_render_plan
from .unified_project_renderer import render as unified_render

def plan_to_project(plan, capabilities=None):
    render_plan=compile_render_plan(plan,capabilities)
    return validate_render_plan(render_plan)

def render_edit_plan(plan, output_path, capabilities=None):
    project=plan_to_project(plan,capabilities)
    return unified_render(project,output_path)
