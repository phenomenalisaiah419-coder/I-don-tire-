"""PHENOVA deployment-configured AI provider router.

Supports real OpenAI-compatible endpoints without embedding credentials:
Grok/xAI, DeepSeek, Groq, and any compatible endpoint.
"""
import os
from .providers import AIProvider, OpenAICompatibleProvider

PROVIDERS = {
    "grok": ("XAI_API_KEY", "XAI_BASE_URL", "XAI_MODEL",
             "https://api.x.ai/v1", "grok-3-mini"),
    "deepseek": ("DEEPSEEK_API_KEY", "DEEPSEEK_BASE_URL", "DEEPSEEK_MODEL",
                 "https://api.deepseek.com", "deepseek-chat"),
    "groq": ("GROQ_API_KEY", "GROQ_BASE_URL", "GROQ_MODEL",
             "https://api.groq.com/openai/v1", "llama-3.3-70b-versatile"),
}

class ConfiguredProvider(AIProvider):
    def __init__(self, name):
        if name not in PROVIDERS:
            raise ValueError(f"Unknown provider: {name}")
        key_env, url_env, model_env, default_url, default_model = PROVIDERS[name]
        key = os.getenv(key_env)
        if not key:
            raise RuntimeError(f"{key_env} is not configured")
        self.name = name
        self.client = OpenAICompatibleProvider(
            os.getenv(url_env, default_url),
            key,
            os.getenv(model_env, default_model),
            int(os.getenv("PHENOVA_AI_TIMEOUT_SECONDS", "90")),
        )

    async def create_edit_plan(self, project_context, instruction):
        return await self.client.create_edit_plan(project_context, instruction)

def get_configured_provider(name=None):
    selected = (name or os.getenv("PHENOVA_AI_PROVIDER", "")).strip().lower()
    if not selected:
        for candidate in ("grok", "deepseek", "groq"):
            if os.getenv(PROVIDERS[candidate][0]):
                selected = candidate
                break
    if not selected:
        raise RuntimeError(
            "No external AI provider configured. Set PHENOVA_AI_PROVIDER and the corresponding API key."
        )
    return ConfiguredProvider(selected)
