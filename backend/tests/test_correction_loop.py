from backend.app.correction_loop import build_correction_context

def test_correction_preserves_previous_plan_context():
    r=build_correction_context(
        {"id":1},[{"id":7}],{"trim":True},{"pacing":{}},
        {"schema_version":"1.0","operations":[]},
        "remove the second pause"
    )
    assert r["previous_plan"]["schema_version"]=="1.0"
    assert r["correction"]=="remove the second pause"

def test_empty_correction_rejected():
    try:
        build_correction_context({},[],{}, {},None," ")
        assert False
    except ValueError:
        assert True
