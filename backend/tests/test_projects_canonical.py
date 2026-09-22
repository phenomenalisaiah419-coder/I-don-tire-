from fastapi.testclient import TestClient
from backend.app.main import app


def auth(client):
    email = "canonical_step2_unique@example.com"
    r = client.post("/api/v1/auth/register", json={"email": email, "password": "password123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_canonical_project_versions_and_ownership():
    c = TestClient(app)
    headers = auth(c)
    created = c.post("/api/v1/projects", headers=headers, json={"name": "Canonical"})
    assert created.status_code == 200
    p = created.json()
    assert p["version"] == 1
    assert p["state"]["tracks"] == []

    updated = c.put(f"/api/v1/projects/{p['id']}/state", headers=headers,
                    json={"state": {"tracks": [{"id": "v1"}], "operations": []}, "reason": "add clip"})
    assert updated.status_code == 200
    assert updated.json()["version"] == 2

    versions = c.get(f"/api/v1/projects/{p['id']}/versions", headers=headers)
    assert versions.status_code == 200
    assert {v["version"] for v in versions.json()} == {1, 2}

    restored = c.post(f"/api/v1/projects/{p['id']}/restore/1", headers=headers)
    assert restored.status_code == 200
    assert restored.json()["state"]["tracks"] == []
