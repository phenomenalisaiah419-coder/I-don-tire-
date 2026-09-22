from abc import ABC, abstractmethod
import httpx
from .config import settings

class TranscriptionProvider(ABC):
    @abstractmethod
    async def transcribe(self, audio_path: str, language: str | None = None) -> dict:
        raise NotImplementedError

class OpenAICompatibleTranscriptionProvider(TranscriptionProvider):
    def __init__(self, base_url: str, api_key: str, model: str, timeout: int = 300):
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.model = model
        self.timeout = timeout

    async def transcribe(self, audio_path: str, language: str | None = None) -> dict:
        headers = {'Authorization': f'Bearer {self.api_key}'}
        data = {'model': self.model, 'response_format': 'verbose_json'}
        if language:
            data['language'] = language
        with open(audio_path, 'rb') as f:
            files = {'file': (audio_path.rsplit('/', 1)[-1], f, 'audio/wav')}
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                r = await client.post(f'{self.base_url}/audio/transcriptions', headers=headers, data=data, files=files)
                r.raise_for_status()
                return r.json()

def get_transcription_provider():
    if settings.ai_provider_url and settings.ai_provider_api_key and settings.transcription_model:
        return OpenAICompatibleTranscriptionProvider(
            settings.ai_provider_url, settings.ai_provider_api_key,
            settings.transcription_model, settings.transcription_timeout_seconds)
    raise RuntimeError('No transcription provider configured')
