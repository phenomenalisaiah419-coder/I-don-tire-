import pytest

def test_empty_plan_rejected():
    from backend.app.services.validated_pipeline import validate_plan
    with pytest.raises(ValueError): validate_plan({"schema_version":"1.0","operations":[]})

def test_unknown_operation_rejected():
    from backend.app.services.validated_pipeline import validate_plan
    with pytest.raises(ValueError): validate_plan({"schema_version":"1.0","operations":[{"operation":"fake"}]})

def test_too_many_operations_rejected():
    from backend.app.services.validated_pipeline import validate_plan,MAX_OPERATIONS
    with pytest.raises(ValueError):
        validate_plan({"schema_version":"1.0","operations":[{"operation":"mute","input_path":"/a"}]*(MAX_OPERATIONS+1)})

def test_bad_range_rejected():
    from backend.app.services.validated_pipeline import validate_plan
    with pytest.raises(ValueError):
        validate_plan({"schema_version":"1.0","operations":[{"operation":"mute","start":3,"end":2}]})

def test_supported_plan_passes():
    from backend.app.services.validated_pipeline import validate_plan
    p=validate_plan({"schema_version":"1.0","operations":[
        {"operation":"mute","track":"video","input_path":"/server/media/a.mp4","start":0,"end":2}
    ]})
    assert p["operations"][0]["operation"]=="mute"
