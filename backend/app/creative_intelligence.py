"""Deterministic creative-intelligence primitives based only on available evidence."""
from dataclasses import dataclass

@dataclass
class Segment:
    start: float
    end: float
    text: str = ""

def validate_segments(segments:list[Segment]) -> list[Segment]:
    ordered=sorted(segments,key=lambda x:x.start)
    for s in ordered:
        if s.start < 0 or s.end <= s.start:
            raise ValueError("Invalid segment timing")
    return ordered

def silence_gaps(segments:list[Segment], threshold:float=1.0) -> list[dict]:
    segs=validate_segments(segments); gaps=[]
    for a,b in zip(segs,segs[1:]):
        gap=b.start-a.end
        if gap>=threshold: gaps.append({"start":a.end,"end":b.start,"duration":gap})
    return gaps

def pacing_metrics(segments:list[Segment]) -> dict:
    segs=validate_segments(segments)
    if not segs: return {"segment_count":0,"total_speech":0.0,"average_segment":0.0,"gap_count":0}
    durations=[s.end-s.start for s in segs]
    return {
        "segment_count":len(segs),
        "total_speech":round(sum(durations),3),
        "average_segment":round(sum(durations)/len(durations),3),
        "gap_count":len(silence_gaps(segs))
    }

def repeated_phrases(segments:list[Segment], min_words:int=2) -> list[dict]:
    seen={}
    for s in validate_segments(segments):
        words=s.text.lower().split()
        for n in range(min_words,min(len(words),5)+1):
            for i in range(len(words)-n+1):
                phrase=" ".join(words[i:i+n])
                seen.setdefault(phrase,[]).append(s.start)
    return [{"phrase":p,"occurrences":len(ts),"times":ts}
            for p,ts in seen.items() if len(ts)>1]
