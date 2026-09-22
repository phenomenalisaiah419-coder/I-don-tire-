from abc import ABC, abstractmethod
import json
import httpx
from .config import settings

class AIProvider(ABC):
    @abstractmethod
    async def create_edit_plan(self, project_context: dict, instruction: str) -> dict:
        raise NotImplementedError

SYSTEM_PROMPT = """You are PHENOVA's editing planner. Return ONLY valid JSON with this shape:
{"intent":"string","operations":[{"operation":"trim|cut|split|delete|reorder|crop|resize|speed|mute|volume|reverse|rotate|concat","asset_id":number,"start":number|null,"end":number|null,"params":{}}]}
Use only operations supported by the supplied capability list. Use only supplied asset IDs. Never invent media facts. If the request cannot be safely mapped to supported operations, return an empty operations array and explain the limitation in intent. Do not execute anything."""

class OpenAICompatibleProvider(AIProvider):
    def __init__(self, base_url: str, api_key: str, model: str, timeout: int = 60):
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.model = model
        self.timeout = timeout

    async def create_edit_plan(self, project_context: dict, instruction: str) -> dict:
        payload = {"model": self.model, "temperature": 0, "messages":[
            {"role":"system","content":SYSTEM_PROMPT},
            {"role":"user","content":json.dumps({"instruction":instruction,"project":project_context}, separators=(',',':'))}
        ]}
        headers={"Authorization":f"Bearer {self.api_key}","Content-Type":"application/json"}
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            r=await client.post(f"{self.base_url}/chat/completions",json=payload,headers=headers)
            r.raise_for_status()
            data=r.json()
        content=data["choices"][0]["message"]["content"]
        content=content.strip()
        if content.startswith("```"):
            content=content.split('\n',1)[1].rsplit("```",1)[0].strip()
        return json.loads(content)

class IndependentProvider(AIProvider):
    async def create_edit_plan(self, project_context: dict, instruction: str) -> dict:
        if not (settings.ai_provider_url and settings.ai_provider_api_key and settings.ai_model):
            raise RuntimeError("No independent AI provider configured")
        return await OpenAICompatibleProvider(settings.ai_provider_url, settings.ai_provider_api_key, settings.ai_model, settings.ai_timeout_seconds).create_edit_plan(project_context, instruction)

class IFECProvider(AIProvider):
    def __init__(self, base_url: str): self.base_url = base_url.rstrip('/')
    async def create_edit_plan(self, project_context: dict, instruction: str) -> dict:
        async with httpx.AsyncClient(timeout=settings.ai_timeout_seconds) as client:
            r=await client.post(f"{self.base_url}/v1/phenova/edit-plan",json={"project":project_context,"instruction":instruction})
            r.raise_for_status(); return r.json()

def get_ai_provider() -> AIProvider:
    if settings.ifec_enabled and settings.ifec_base_url:
        return IFECProvider(settings.ifec_base_url)
    return IndependentProvider()

class GoogleSpeechToTextProvider:
    """Google Cloud Speech-to-Text adapter; credentials are deployment configuration."""
    def __init__(self, project_id: str | None = None):
        self.project_id = project_id

    async def transcribe(self, audio_path: str) -> dict:
        try:
            from google.cloud import speech
        except ImportError as exc:
            raise RuntimeError('Google Cloud Speech-to-Text dependency is not installed') from exc
        client = speech.SpeechClient()
        with open(audio_path, 'rb') as f:
            content = f.read()
        audio = speech.RecognitionAudio(content=content)
        config = speech.RecognitionConfig(
            encoding=speech.RecognitionConfig.AudioEncoding.ENCODING_UNSPECIFIED,
            language_code='en-US', enable_word_time_offsets=True,
            enable_automatic_punctuation=True,
        )
        response = client.recognize(config=config, audio=audio)
        segments=[]
        for idx, result in enumerate(response.results):
            if not result.alternatives: continue
            alt=result.alternatives[0]
            if alt.words:
                start=alt.words[0].start_time.total_seconds(); end=alt.words[-1].end_time.total_seconds()
            else: start=end=0.0
            segments.append({'id':idx,'start':start,'end':end,'text':alt.transcript})
        return {'provider':'google-speech-to-text','segments':segments}
