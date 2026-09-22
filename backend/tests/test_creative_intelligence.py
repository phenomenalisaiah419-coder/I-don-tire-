from backend.app.creative_intelligence import Segment, pacing_metrics, silence_gaps, repeated_phrases

def test_pacing_and_gaps():
    s=[Segment(0,1,"hello there"),Segment(2.5,4,"hello there")]
    m=pacing_metrics(s)
    assert m["segment_count"]==2
    assert m["gap_count"]==1
    assert silence_gaps(s)[0]["duration"]==1.5

def test_repetition_is_evidence_based():
    s=[Segment(0,1,"we need this plan"),Segment(3,4,"we need this plan")]
    r=repeated_phrases(s)
    assert any(x["phrase"]=="we need this" for x in r)
