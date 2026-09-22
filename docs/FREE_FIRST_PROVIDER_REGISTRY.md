# PHENOVA Free-First Provider Registry

This registry is intentionally provider-adapter oriented. Free tiers and quotas change;
the app must enforce `allowPaid=false` and refuse providers that cannot prove zero-cost routing.

## AI / reasoning
- OpenRouter: `https://openrouter.ai/api/v1`, model `openrouter/free`
- Gemini API: free quota when available
- Groq: developer free limits where available
- Cloudflare Workers AI: free allocation where eligible
- Hugging Face Inference Providers: limited credits where eligible
- Ollama: local models
- llama.cpp: local quantized models

## Search / references
- Brave Search API
- Tavily
- Serper
- YouTube Data API
- Wikimedia Commons API
- Internet Archive APIs
- Pexels API
- Pixabay API
- Unsplash API

## Local media intelligence
- FFmpeg
- OpenCV
- MediaPipe
- ONNX Runtime
- LiteRT / TensorFlow Lite
- Whisper.cpp
- Silero VAD
- Scene detection models
- Object detection models

## Audio / captions
- Piper
- Kokoro
- eSpeak NG
- Freesound API
- Argos Translate
- LibreTranslate (self-hosted/public instances only with explicit endpoint config)

## Guardrails
- Never embed provider secrets in the APK.
- Default OpenRouter model is `openrouter/free`, not `openrouter/auto`.
- Never silently fall back from a free provider to a paid model.
- Store provider provenance and model IDs with every AI result.
- Make provider availability and quota visible in diagnostics.
