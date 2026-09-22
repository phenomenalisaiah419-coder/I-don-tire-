from dataclasses import dataclass

@dataclass(frozen=True)
class TranscriptEdit:
    segment_id: int
    start: float
    end: float
    text: str

def validate_segment_range(start: float, end: float) -> None:
    if start < 0 or end <= start:
        raise ValueError('Invalid transcript time range')

def transcript_to_operations(edits: list[TranscriptEdit]) -> list[dict]:
    ops=[]
    for e in edits:
        validate_segment_range(e.start,e.end)
        ops.append({'operation':'replace_transcript_segment','segment_id':e.segment_id,'start':e.start,'end':e.end,'text':e.text})
    return ops
