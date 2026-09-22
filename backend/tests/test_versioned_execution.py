from backend.app.services.versioned_execution import execute_versioned_plan

def test_execution_creates_child_version():
    r=execute_versioned_plan(9,{"schema_version":"1.0","operations":[{"operation":"trim"}]},3)
    assert r["project_id"]==9
    assert r["parent_version_id"]==3
    assert r["status"]=="READY_FOR_CANONICAL_EXECUTOR"
    assert r["operation_count"]==1

def test_invalid_plan_cannot_execute():
    try:
        execute_versioned_plan(1,{"schema_version":"bad","operations":[]})
        assert False
    except ValueError:
        assert True
