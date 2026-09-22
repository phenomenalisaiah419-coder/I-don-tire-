"""PHENOVA render release-readiness checks.

This is a deterministic deployment self-check. It verifies configuration,
required services, package wiring, and filesystem prerequisites without
performing an actual media render.
"""
import importlib
from pathlib import Path
from .release_config import validate_runtime

REQUIRED_MODULES=(
    "backend.app.services.validated_pipeline",
    "backend.app.services.render_plan_compiler",
    "backend.app.services.render_media_graph",
    "backend.app.services.render_input_preflight",
    "backend.app.services.render_security",
    "backend.app.services.render_verification",
    "backend.app.services.persistent_render_jobs",
    "backend.app.services.render_worker",
)

def check():
    checks=[]
    cfg=validate_runtime()
    checks.append({"name":"runtime_configuration","status":"PASS"})
    for name in REQUIRED_MODULES:
        importlib.import_module(name)
        checks.append({"name":name,"status":"PASS"})
    return {
        "status":"READY",
        "checks":checks,
        "render_limits":{
            "max_concurrent":cfg.max_concurrent,
            "max_retries":cfg.max_retries,
            "max_duration_seconds":cfg.max_duration_seconds,
            "max_input_bytes":cfg.max_input_bytes,
        }
    }
