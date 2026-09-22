def test_edit_creation_is_atomic(tmp_path,monkeypatch):
    import backend.app.services.edit_creation as ec
    monkeypatch.setattr(ec,"DB_PATH",str(tmp_path/"db.sqlite"))
    assert ec.create_edit("u","basic",limit=2)[0] is not None
    assert ec.create_edit("u","basic",limit=2)[0] is not None
    assert ec.create_edit("u","basic",limit=2)[0] is None

def test_premium_has_no_daily_limit(tmp_path,monkeypatch):
    import backend.app.services.edit_creation as ec
    monkeypatch.setattr(ec,"DB_PATH",str(tmp_path/"db.sqlite"))
    for _ in range(4):
        assert ec.create_edit("u","basic",premium=True)[0] is not None
