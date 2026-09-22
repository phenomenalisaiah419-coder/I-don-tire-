def test_persistent_plan_and_cancel(tmp_path,monkeypatch):
    from backend.app.services import persistent_render_jobs as jobs
    monkeypatch.setattr(jobs,"DB_PATH",str(tmp_path/"jobs.sqlite"))
    plan={"operations":[{"operation":"transform","track":"video","input_path":"/tmp/a.mp4","start":0,"end":1}]}
    jid=jobs.create("7",plan,"/tmp/out.mp4")
    item=jobs.get(jid,"7")
    assert item["status"]=="QUEUED"
    assert item["plan"]==plan
    assert jobs.request_cancel(jid,"7")
    assert jobs.get(jid,"7")["status"]=="CANCELLED"

def test_claim_is_single_winner(tmp_path,monkeypatch):
    from backend.app.services import persistent_render_jobs as jobs
    monkeypatch.setattr(jobs,"DB_PATH",str(tmp_path/"jobs.sqlite"))
    jid=jobs.create("7",{"operations":[]}, "/tmp/out.mp4")
    assert jobs.claim("w1")==jid
    assert jobs.claim("w2") is None

def test_recovery_requeues_stale(tmp_path,monkeypatch):
    from backend.app.services import persistent_render_jobs as jobs
    monkeypatch.setattr(jobs,"DB_PATH",str(tmp_path/"jobs.sqlite"))
    jid=jobs.create("7",{"operations":[]}, "/tmp/out.mp4")
    assert jobs.claim("w1")==jid
    # Force the record to look stale.
    c=jobs._db()
    c.execute("UPDATE render_jobs SET updated_at='2000-01-01T00:00:00+00:00' WHERE id=?",(jid,))
    c.close()
    assert jobs.recover_stale(1)==1
    assert jobs.get(jid)["status"]=="QUEUED"
