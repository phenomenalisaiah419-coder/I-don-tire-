import subprocess
from pathlib import Path

from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.db import SessionLocal
from backend.app.models import MediaAsset
from backend.app.media_engine import ensure_ffmpeg


def _auth(client, suffix="exec"):
    email = f"plan_{suffix}_step4@example.com"
    r = client.post("/api/v1/auth/register", json={"email": email, "password": "password123"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _video(path: Path):
    r = subprocess.run(
        ["ffmpeg", "-y", "-f", "lavfi", "-i", "testsrc=size=320x240:rate=10:duration=3",
         "-f", "lavfi", "-i", "sine=frequency=440:duration=3", "-c:v", "libx264", "-c:a", "aac",
         "-shortest", str(path)], capture_output=True, text=True)
    assert r.returncode == 0, r.stderr[-2000:]


def test_validated_plan_executes_and_records_operation(tmp_path):
    if not ensure_ffmpeg():
        return
    client = TestClient(app)
    headers = _auth(client, "execute")
    project = client.post("/api/v1/projects", headers=headers, json={"name": "Execution"}).json()
    source = tmp_path / "source.mp4"
    _video(source)

    db = SessionLocal()
    try:
        asset = MediaAsset(project_id=project["id"], filename=source.name, path=str(source),
                           mime_type="video/mp4", size_bytes=source.stat().st_size, metadata_json={}, sha256="")
        db.add(asset); db.commit(); db.refresh(asset)
        asset_id = asset.id
    finally:
        db.close()

    plan = client.post("/api/v1/edit-plans/validate", headers=headers, json={
        "project_id": project["id"],
        "intent": "Make a short cut",
        "operations": [{"operation": "trim", "asset_id": asset_id, "start": 0, "end": 1.5, "params": {"start": 0, "end": 1.5}}],
    })
    assert plan.status_code == 200, plan.text
    plan_id = plan.json()["id"]

    result = client.post(f"/api/v1/edit-plans/{plan_id}/execute", headers=headers)
    assert result.status_code == 200, result.text
    body = result.json()
    assert body["status"] == "COMPLETED"
    assert Path(db_asset_path(body["output_asset_id"])).is_file()

    log = client.get(f"/api/v1/edit-plans/{plan_id}/operations", headers=headers)
    assert log.status_code == 200
    assert log.json()[0]["status"] == "COMPLETED"


def db_asset_path(asset_id: int):
    db = SessionLocal()
    try:
        return db.get(MediaAsset, asset_id).path
    finally:
        db.close()
