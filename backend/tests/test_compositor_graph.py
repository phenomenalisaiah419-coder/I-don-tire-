from app.services.compositor_graph import build_compositor_filters

def test_compositor_graph_builds_text_and_audio_filters():
    result = build_compositor_filters({
        "overlays": [{"kind": "text", "text": "Hello", "start": 0, "end": 2}],
        "audios": [{"volume": 0.5, "fadeIn": 1}],
    })
    assert any("drawtext" in f for f in result["filters"])
    assert any("volume=0.5" in f for f in result["filters"])
