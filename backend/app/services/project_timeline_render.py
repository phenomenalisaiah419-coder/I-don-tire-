"""Compile an owned project's canonical timeline into a real render plan.

The project database owns asset paths; the canonical timeline owns ordering and
clip structure. The two are joined only on the server.
"""
from sqlalchemy.orm import Session
from ..models import Project, MediaAsset
from .timeline_snapshot import latest as latest_timeline
from .editplan_render_pipeline import plan_to_project
from .validated_pipeline import validate_plan

def _owned_project(db:Session,project_id:int,user_id:int):
    project=db.get(Project,project_id)
    if not project or project.owner_id!=user_id:
        raise ValueError("Project not found")
    return project

def timeline_to_plan(db:Session,project_id:int,user_id:int,capabilities=None):
    project=_owned_project(db,project_id,user_id)
    snap=latest_timeline(project_id)
    state=(snap["state"] if snap else (project.state_json or {}))
    clips=state.get("clips",[])
    if not clips:
        raise ValueError("Project timeline contains no clips")

    asset_ids={int(c["asset_id"]) for c in clips if c.get("asset_id") is not None}
    assets=db.query(MediaAsset).filter(MediaAsset.project_id==project_id,
                                       MediaAsset.id.in_(asset_ids)).all()
    by_id={a.id:a for a in assets}
    if len(by_id)!=len(asset_ids):
        raise ValueError("Timeline references missing project media")

    ordered=sorted(clips,key=lambda c:(str(c.get("track_id","video")),float(c.get("start",0))))
    videos=[]
    for c in ordered:
        if str(c.get("track_id","video"))!="video": continue
        asset=by_id.get(int(c.get("asset_id")))
        if not asset or not asset.path: raise ValueError("Timeline clip has no valid media asset")
        start=float(c.get("source_start",0))
        duration=float(c.get("duration",0))
        if duration<=0: raise ValueError("Timeline contains a non-positive clip duration")
        node={"operation":"trim","track":"video","input_path":asset.path,
              "start":start,"end":start+duration}
        for key in ("transition","overlap","x","y","x_points","y_points",
                    "scale_points","rotation_points","opacity_points"):
            if key in c: node[key]=c[key]
        videos.append(node)

    if not videos: raise ValueError("Timeline contains no video clips")
    plan={"schema_version":"1.1","project_id":project_id,"operations":videos}
    return validate_plan(plan,capabilities)
