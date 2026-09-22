from backend.app.validated_pipeline import validate_plan

def test_valid_plan():
    p={"schema_version":"1.0","operations":[{"operation":"transform"}]}
    r=validate_plan(p,{"operations":["transform"]})
    assert r["schema_version"]=="1.0"

def test_capability_gate():
    try: validate_plan({"schema_version":"1.0","operations":[{"operation":"transform"}]},
                       {"operations":["trim"]}); assert False
    except ValueError: return

def test_bad_schema():
    try: validate_plan({"schema_version":"2.0","operations":[]},{}); assert False
    except ValueError: return
