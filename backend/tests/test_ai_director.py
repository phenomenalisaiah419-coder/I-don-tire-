import asyncio
from backend.app.ai_director import DirectorContext, generate_validated_plan, validate_director_plan

class Provider:
    async def create_plan(self, context, instruction):
        assert context["media"][0]["id"] == 7
        return {"schema_version":"1.0","operations":[
            {"operation":"trim","asset_id":7,"start":0,"end":3}
        ]}

def test_director_generates_validated_plan():
    p=asyncio.run(generate_validated_plan(
        Provider(),
        DirectorContext(
            project={"id":1},
            media=[{"id":7,"duration":5}],
            capabilities={"trim":True},
            evidence={"pacing":{}},
        ),
        "Make the opening shorter"
    ))
    assert p["operations"][0]["asset_id"] == 7

def test_invalid_plan_rejected():
    try:
        validate_director_plan({"schema_version":"9","operations":[]})
        assert False
    except ValueError:
        assert True
