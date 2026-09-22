from abc import ABC, abstractmethod

class VisualAnalysisProvider(ABC):
    @abstractmethod
    async def analyze(self, image_paths:list[str]) -> dict:
        raise NotImplementedError

class SpeechAnalysisProvider(ABC):
    @abstractmethod
    async def analyze(self, audio_path:str) -> dict:
        raise NotImplementedError

class NoVisualProvider(VisualAnalysisProvider):
    async def analyze(self, image_paths:list[str]) -> dict:
        raise RuntimeError("No visual analysis provider configured")

class NoSpeechProvider(SpeechAnalysisProvider):
    async def analyze(self, audio_path:str) -> dict:
        raise RuntimeError("No speech analysis provider configured")
