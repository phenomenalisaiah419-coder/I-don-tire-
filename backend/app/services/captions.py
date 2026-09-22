"""Caption/subtitle generation from verified transcript timing."""
import html, re

def _timecode(seconds: float) -> str:
    if seconds < 0: raise ValueError("Negative caption time")
    ms=round(seconds*1000)
    h,ms=divmod(ms,3600000); m,ms=divmod(ms,60000); s,ms=divmod(ms,1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

def validate_segments(segments:list[dict]) -> list[dict]:
    out=[]
    for seg in segments:
        if "id" not in seg or "start" not in seg or "end" not in seg or "text" not in seg:
            raise ValueError("Caption segment requires id, start, end and text")
        start=float(seg["start"]); end=float(seg["end"])
        if start < 0 or end <= start: raise ValueError("Invalid caption timing")
        text=str(seg["text"]).strip()
        if not text: continue
        out.append({"id":int(seg["id"]),"start":start,"end":end,"text":text})
    return sorted(out,key=lambda x:x["start"])

def to_srt(segments:list[dict]) -> str:
    segs=validate_segments(segments)
    blocks=[]
    for i,s in enumerate(segs,1):
        blocks.append(f"{i}\n{_timecode(s['start'])} --> {_timecode(s['end'])}\n{s['text']}\n")
    return "\n".join(blocks)

def to_vtt(segments:list[dict]) -> str:
    segs=validate_segments(segments)
    def tc(x):
        return _timecode(x).replace(",",".")
    lines=["WEBVTT",""]
    for s in segs:
        lines += [f"{tc(s['start'])} --> {tc(s['end'])}",s["text"],""]
    return "\n".join(lines)

def split_for_display(text:str,max_chars:int=42)->list[str]:
    words=re.findall(r"\S+",text)
    lines=[]; current=""
    for w in words:
        candidate=(current+" "+w).strip()
        if len(candidate)>max_chars and current:
            lines.append(current); current=w
        else: current=candidate
    if current: lines.append(current)
    return lines
