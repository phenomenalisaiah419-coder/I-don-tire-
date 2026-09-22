def test_error_codes():
    from backend.app.services.render_errors import classify
    assert classify(ValueError("Render input not found"))=="RENDER_INPUT_INVALID"
    assert classify(ValueError("Render output is missing or empty"))=="RENDER_OUTPUT_INVALID"
    assert classify(ValueError("Render input is outside the PHENOVA media directory"))=="RENDER_SECURITY_REJECTED"
    assert classify(RuntimeError("boom"))=="RENDER_EXECUTION_FAILED"
def test_events(tmp_path,monkeypatch):
    from backend.app.services import render_events
    monkeypatch.setattr(render_events,"DB_PATH",str(tmp_path/"events.sqlite"))
    render_events.record("j1","started",{"worker":"w1"})
    assert render_events.recent("j1")[0]["detail"]["worker"]=="w1"
