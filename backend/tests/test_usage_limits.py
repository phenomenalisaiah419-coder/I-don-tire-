def test_atomic_reservation(tmp_path,monkeypatch):
    import backend.app.services.usage_limits as u
    monkeypatch.setattr(u,"DB_PATH",str(tmp_path/"usage.sqlite"))
    assert u.reserve_edit("a","basic",2)
    assert u.reserve_edit("a","basic",2)
    assert not u.reserve_edit("a","basic",2)
    assert u.get_usage("a")["basic_edits"]==2

def test_signup_age():
    from datetime import datetime,timezone,timedelta
    from backend.app.services.premium_policy import days_since_signup
    d=datetime.now(timezone.utc)-timedelta(days=31)
    assert days_since_signup(d)>=31
