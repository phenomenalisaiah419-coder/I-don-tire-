import json
import httpx

class OpenAICompatibleDirectorProvider:
    """Adapter for an authorized OpenAI-compatible chat endpoint.

    Endpoint/model/API key are deployment configuration. The provider must return JSON
    matching the PHENOVA Edit Plan schema; invalid output is rejected by the Director.
    """
    def __init__(self, base_url:str, api_key:str, model:str):
        self.base_url=base_url.rstrip("/")
        self.api_key=api_key
        self.model=model

    async def create_plan(self, context:dict, instruction:str)->dict:
        system = (
            "You are PHENOVA AI Director. Return ONLY a JSON Edit Plan with "
            "schema_version '1.0' and an operations array. Use only assets and "
            "capabilities supplied in context. Never invent media evidence."
        )
        payload={"model":self.model,"temperature":0,
                 "messages":[
                    {"role":"system","content":system},
                    {"role":"user","content":json.dumps({"instruction":instruction,"context":context})}
                 ]}
        async with httpx.AsyncClient(timeout=90) as client:
            r=await client.post(self.base_url+"/chat/completions",
                headers={"Authorization":f"Bearer {self.api_key}"},
                json=payload)
            r.raise_for_status()
            data=r.json()
        content=data["choices"][0]["message"]["content"]
        return json.loads(content)
