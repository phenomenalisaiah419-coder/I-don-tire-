from backend.app.services.sync import TranscriptEdit, transcript_to_operations

def test_transcript_edit_maps_to_operation():
    ops=transcript_to_operations([TranscriptEdit(3,1.0,2.5,'corrected')])
    assert ops[0]['segment_id']==3 and ops[0]['start']==1.0 and ops[0]['end']==2.5

def test_invalid_range_rejected():
    try: transcript_to_operations([TranscriptEdit(1,2.0,1.0,'bad')])
    except ValueError: return
    assert False
