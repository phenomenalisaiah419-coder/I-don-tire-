from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import Project, ProjectVersion, User
from ..schemas import ProjectCreate, ProjectStateUpdate
from ..security import get_current_user

router = APIRouter()


def _owned(db: Session, project_id: int, user_id: int) -> Project:
    project = db.get(Project, project_id)
    if not project or project.owner_id != user_id:
        raise HTTPException(404, "Project not found")
    return project


def _snapshot(db: Session, project: Project, reason: str):
    db.add(ProjectVersion(
        project_id=project.id,
        version=project.version,
        state_json=project.state_json or {},
        reason=reason,
    ))


@router.post("")
def create_project(body: ProjectCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    state = {"assets": [], "tracks": [], "operations": [], "settings": {}, "ai": {"history": []}}
    project = Project(owner_id=user.id, name=body.name.strip(), version=1, state_json=state)
    db.add(project)
    db.flush()
    _snapshot(db, project, "initial")
    db.commit(); db.refresh(project)
    return {"id": project.id, "name": project.name, "version": project.version, "state": project.state_json}


@router.get("")
def list_projects(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return [
        {"id": p.id, "name": p.name, "version": p.version,
         "updated_at": p.updated_at.isoformat() if p.updated_at else None}
        for p in db.query(Project).filter(Project.owner_id == user.id).order_by(Project.id.desc()).all()
    ]


@router.get("/{project_id}")
def get_project(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = _owned(db, project_id, user.id)
    return {"id": project.id, "name": project.name, "version": project.version,
            "owner_id": project.owner_id, "state": project.state_json or {},
            "created_at": project.created_at.isoformat() if project.created_at else None,
            "updated_at": project.updated_at.isoformat() if project.updated_at else None}


@router.put("/{project_id}/state")
def update_state(project_id: int, body: ProjectStateUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = _owned(db, project_id, user.id)
    project.version += 1
    project.state_json = body.state
    _snapshot(db, project, body.reason)
    db.commit(); db.refresh(project)
    return {"id": project.id, "version": project.version, "state": project.state_json}


@router.get("/{project_id}/versions")
def versions(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _owned(db, project_id, user.id)
    rows = db.query(ProjectVersion).filter(ProjectVersion.project_id == project_id).order_by(ProjectVersion.version.desc()).limit(20).all()
    return [{"id": r.id, "version": r.version, "reason": r.reason, "state": r.state_json,
             "created_at": r.created_at.isoformat() if r.created_at else None} for r in rows]


@router.post("/{project_id}/restore/{version}")
def restore(project_id: int, version: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = _owned(db, project_id, user.id)
    source = db.query(ProjectVersion).filter(ProjectVersion.project_id == project_id, ProjectVersion.version == version).first()
    if not source:
        raise HTTPException(404, "Version not found")
    _snapshot(db, project, f"before-restore:{version}")
    project.version += 1
    project.state_json = source.state_json
    db.commit(); db.refresh(project)
    return {"id": project.id, "version": project.version, "restored_from": version, "state": project.state_json}


@router.delete("/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    project = _owned(db, project_id, user.id)
    db.delete(project)
    db.commit()
    return {"ok": True, "id": project_id}
