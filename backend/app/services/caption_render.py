"""Real FFmpeg ASS subtitle generation and burn-in rendering."""
from pathlib import Path
import subprocess, html
from .config import settings

def _ass_time(seconds:float)->str:
    if seconds<0: raise ValueError("Negative caption time")
    cs=round(seconds*100)
    h,cs=divmod(cs,360000); m,cs=divmod(cs,6000); s,cs=divmod(cs,100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"

def build_ass(segments:list[dict], style:dict|None=None)->str:
    style=style or {}
    font=str(style.get("font","Arial")).replace(",","")
    size=int(style.get("size",48))
    bold=-1 if style.get("bold",True) else 0
    outline=int(style.get("outline",2))
    lines=[
        "[Script Info]","ScriptType: v4.00+","PlayResX: 1920","PlayResY: 1080","",
        "[V4+ Styles]",
        "Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding",
        f"Style: Default,{font},{size},&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,{bold},0,0,0,100,100,0,0,1,{outline},1,2,2,40,40,60,1",
        "","[Events]","Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text"
    ]
    for seg in sorted(segments,key=lambda x:float(x["start"])):
        start=float(seg["start"]); end=float(seg["end"])
        if start<0 or end<=start: raise ValueError("Invalid caption timing")
        text=html.escape(str(seg.get("text",""))).replace("\n",r"\N")
        if not text: continue
        lines.append(f"Dialogue: 0,{_ass_time(start)},{_ass_time(end)},Default,,0,0,0,,{text}")
    return "\n".join(lines)+"\n"

def burn_in(input_path:str, ass_path:str, output_path:str)->str:
    # Escape Windows-sensitive characters in filter path as far as practical.
    filt="subtitles="+ass_path.replace("\\","/").replace(":","\\:")
    p=subprocess.run([settings.ffmpeg_bin,"-y","-i",input_path,"-vf",filt,
                      "-c:a","copy",output_path],capture_output=True,text=True)
    if p.returncode: raise RuntimeError(p.stderr[-4000:])
    if not Path(output_path).exists(): raise RuntimeError("No caption-rendered output produced")
    return output_path
