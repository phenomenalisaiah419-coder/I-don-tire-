from backend.app.models import Transcript, MediaAnalysis

def test_intelligence_models_exist():
    assert Transcript.__tablename__ == 'transcripts'
    assert MediaAnalysis.__tablename__ == 'media_analyses'
