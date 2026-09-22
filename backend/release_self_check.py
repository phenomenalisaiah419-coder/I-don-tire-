"""PHENOVA release self-check: validates source integrity and critical imports."""
import ast, importlib
from pathlib import Path

ROOT=Path(__file__).resolve().parent
ERRORS=[]

for p in (ROOT/"app").rglob("*.py"):
    try: ast.parse(p.read_text(errors="ignore"),filename=str(p))
    except SyntaxError as e: ERRORS.append(f"{p.relative_to(ROOT)}:{e.lineno}: {e.msg}")

MODULES=[
 "backend.app.services.unified_project_renderer",
 "backend.app.services.integrated_project_renderer",
 "backend.app.services.transition_aware_compositor",
 "backend.app.services.persistent_render_jobs",
 "backend.app.services.render_security",
 "backend.app.services.render_input_preflight",
 "backend.app.services.validated_pipeline",
 "backend.app.services.owner_access",
]
for name in MODULES:
    try: importlib.import_module(name)
    except Exception as e: ERRORS.append(f"import {name}: {e}")

if __name__=="__main__":
    if ERRORS:
        print("RELEASE SELF-CHECK FAILED")
        print("\n".join(ERRORS))
        raise SystemExit(1)
    print("RELEASE SELF-CHECK PASSED")
