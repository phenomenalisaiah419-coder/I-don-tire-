def test_concurrency_limit(tmp_path,monkeypatch):
    from backend.app.services import persistent_render_jobs as j
    monkeypatch.setattr(j,"DB_PATH",str(tmp_path/"j.sqlite"))
    monkeypatch.setattr(j,"MAX_CONCURRENT",1)
    a=j.create("1",{"operations":[]},"/tmp/a.mp4")
    b=j.create("1",{"operations":[]},"/tmp/b.mp4")
    assert j.claim("w1")==a
    assert j.claim("w2") is None
    assert j.queued_count()==1

def test_stale_job_recovery_and_retry_limit(tmp_path,monkeypatch):
    from backend.app.services import persistent_render_jobs as j
    monkeypatch.setattr(j,"DB_PATH",str(tmp_path/"j.sqlite"))
    monkeypatch.setattr(j,"MAX_RETRIES",1)
    jid=j.create("1",{"operations":[]},"/tmp/a.mp4")
    assert j.claim("w1")==jid
    c=j._db(); c.execute("UPDATE render_jobs SET heartbeat_at='2000-01-01T00:00:00+00:00' WHERE id=?",(jid,)); c.close()
    assert j.recover_stale(1)==1
    assert j.get(jid)["status"]=="QUEUED"
    assert j.claim("w2")==jid
    c=j._db(); c.execute("UPDATE render_jobs SET heartbeat_at='2000-01-01T00:00:00+00:00',retry_count=1 WHERE id=?",(jid,)); c.close()
    assert j.recover_stale(1)==1
    assert j.get(jid)["status"]=="FAILED"
