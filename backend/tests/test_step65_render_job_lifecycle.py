def test_queued_cancel_is_terminal(tmp_path,monkeypatch):
    from backend.app.services import persistent_render_jobs as j
    monkeypatch.setattr(j,"DB_PATH",str(tmp_path/"jobs.sqlite"))
    jid=j.create("7",{"operations":[]},"/tmp/x.mp4")
    assert j.request_cancel(jid,"7")
    assert j.get(jid)["status"]=="CANCELLED"
    assert j.claim("worker") is None

def test_running_cancel_becomes_cancelling(tmp_path,monkeypatch):
    from backend.app.services import persistent_render_jobs as j
    monkeypatch.setattr(j,"DB_PATH",str(tmp_path/"jobs.sqlite"))
    jid=j.create("7",{"operations":[]},"/tmp/x.mp4")
    assert j.claim("worker")==jid
    assert j.request_cancel(jid,"7")
    assert j.get(jid)["status"]=="CANCELLING"

def test_event_endpoint_source_has_limit():
    p=__import__("pathlib").Path("backend/app/routes/render_jobs.py")
    text=p.read_text()
    assert 'le=100' in text
