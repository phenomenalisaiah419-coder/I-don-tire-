from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def token(email):
    r = client.post("/api/v1/auth/register", json={"email": email, "password": "secret12345"})
    if r.status_code == 409:
        r = client.post("/api/v1/auth/login", json={"email": email, "password": "secret12345"})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_register_login():
    h = token("testuser_phenova@example.com")
    assert h["Authorization"].startswith("Bearer ")


def test_create_and_list_projects():
    h = token("projects_phenova@example.com")
    r = client.post("/api/v1/projects", headers=h, json={"name": "Auth Project Test"})
    assert r.status_code == 200
    pid = r.json()["id"]
    assert r.json()["name"] == "Auth Project Test"

    lst = client.get("/api/v1/projects", headers=h)
    assert lst.status_code == 200
    ids = [p["id"] for p in lst.json()]
    assert pid in ids

    one = client.get(f"/api/v1/projects/{pid}", headers=h)
    assert one.status_code == 200
    assert one.json()["id"] == pid


def test_project_requires_authentication():
    assert client.get("/api/v1/projects").status_code == 401
