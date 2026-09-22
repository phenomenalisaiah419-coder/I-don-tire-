import os
import subprocess
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.db import SessionLocal
from backend.app.models import User
from backend.app.security import hash_password, create_token

client = TestClient(app)

def auth(email):
    db = SessionLocal()
    user = User(email=email, password_hash=hash_password("secret12345"))
    db.add(user); db.commit(); db.refresh(user)
    token = create_token(user.id)
    db.close()
    return {"Authorization": f"Bearer {token}"}

def project(headers, name):
    r = client.post("/api/v1/projects", headers=headers, json={"name": name})
    assert r.status_code == 200
    return r.json()["id"]

def make_video(path):
    r = subprocess.run([
        "ffmpeg", "-y", "-f", "lavfi", "-i", "color=c=red:s=160x120:d=1",
        "-f", "lavfi", "-i", "sine=frequency=440:duration=1",
        "-c:v", "libx264", "-c:a", "aac", "-shortest", path
    ], capture_output=True, text=True)
    assert r.returncode == 0, r.stderr[-500:]

def test_media_upload_validates_real_content(tmp_path):
    h = auth("media_api_valid@example.com")
    pid = project(h, "Media API")
    video = tmp_path / "clip.mp4"
    make_video(str(video))
    with open(video, "rb") as f:
        r = client.post(f"/api/v1/media/upload?project_id={pid}", headers=h,
                        files={"file": ("clip.mp4", f, "video/mp4")})
    assert r.status_code == 200
    body = r.json()
    assert body["metadata"]["validated"] is True
    assert body["metadata"]["video"]["width"] == 160
    assert body["metadata"]["video"]["height"] == 120
    assert body["metadata"]["audio"]["channels"] >= 1
    assert len(body["sha256"]) == 64

def test_media_upload_rejects_corrupt_video(tmp_path):
    h = auth("media_api_corrupt@example.com")
    pid = project(h, "Corrupt Media")
    bad = tmp_path / "bad.mp4"
    bad.write_bytes(b"not-a-real-video")
    with open(bad, "rb") as f:
        r = client.post(f"/api/v1/media/upload?project_id={pid}", headers=h,
                        files={"file": ("bad.mp4", f, "video/mp4")})
    assert r.status_code == 422

def test_media_project_ownership_is_enforced(tmp_path):
    owner = auth("media_owner@example.com")
    other = auth("media_other@example.com")
    pid = project(owner, "Private Media")
    assert client.get(f"/api/v1/media/project/{pid}", headers=other).status_code == 404
