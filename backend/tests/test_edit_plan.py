from backend.app.schemas import EditPlanRequest, EditOperation

def test_plan_schema():
    p = EditPlanRequest(project_id=1, intent="trim", operations=[
        EditOperation(operation="trim", asset_id=2, start=0, end=5)
    ])
    assert p.operations[0].end == 5
