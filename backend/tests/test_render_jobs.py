from backend.app.services.render_jobs import create_job,get_job,run_job,cancel_job

def test_job_lifecycle(monkeypatch,tmp_path):
    monkeypatch.setattr("backend.app.services.render_jobs.render_edit_plan",
                        lambda plan,out,caps: out)
    jid=create_job({"operations":[]},str(tmp_path/"out.mp4"))
    assert get_job(jid)["status"]=="QUEUED"
    run_job(jid,{"operations":[]},str(tmp_path/"out.mp4"),{})
    assert get_job(jid)["status"]=="COMPLETED"
    assert get_job(jid)["progress"]==100

def test_cancel_queued(tmp_path):
    jid=create_job({},str(tmp_path/"o.mp4"))
    assert cancel_job(jid) is True
    assert get_job(jid)["status"]=="CANCELLING"

def test_unknown_job():
    assert get_job("missing") is None
