import os
import pytest

def test_provider_defaults(monkeypatch):
    from backend.app.multi_provider import get_configured_provider
    monkeypatch.setenv("XAI_API_KEY","test-key")
    monkeypatch.setenv("PHENOVA_AI_PROVIDER","grok")
    p=get_configured_provider()
    assert p.name=="grok"
    assert p.client.base_url=="https://api.x.ai/v1"
    assert p.client.model=="grok-3-mini"

def test_no_provider_is_explicit(monkeypatch):
    for key in ("XAI_API_KEY","DEEPSEEK_API_KEY","GROQ_API_KEY"):
        monkeypatch.delenv(key,raising=False)
    monkeypatch.delenv("PHENOVA_AI_PROVIDER",raising=False)
    from backend.app.multi_provider import get_configured_provider
    with pytest.raises(RuntimeError):
        get_configured_provider()
