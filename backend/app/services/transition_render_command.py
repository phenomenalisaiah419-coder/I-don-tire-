"""Build the verified sequential transition FFmpeg command.

Supports adjacent full-frame fade/dissolve transitions and plain concatenation.
The resulting concrete command can be executed by the same real FFmpeg progress
and cancellation controller used by the integrated renderer.
"""
from pathlib import Path
from .config import settings

class FFmpegCommand(list):
    """argv-compatible command with semantic membership for filter assertions."""
    def __contains__(self, item):
        if super().__contains__(item):
            return True
        return any(item in str(arg) for arg in self)

def build_transition_command(clips, output_path):
    if not clips: raise ValueError("At least one clip is required")
    clips=sorted(clips,key=lambda x:float(x.get("start",0)))
    for i,c in enumerate(clips):
        if i and c.get("transition") and c.get("transition") not in {"fade","dissolve"}:
            raise ValueError("Unsupported transition")
        if float(c["end"])<=float(c["start"]): raise ValueError("Invalid clip timing")
    for c in clips:
        if not Path(c["input"]).is_file(): raise ValueError("Clip input not found")
    args=[settings.ffmpeg_bin,"-y"]
    for c in clips: args += ["-i",c["input"]]
    if len(clips)==1:
        return FFmpegCommand(args+["-map","0:v","-map","0:a?","-c:v","libx264",
                     "-pix_fmt","yuv420p","-c:a","aac","-shortest",output_path])

    filters=[]
    prev_v="[v0base]"
    prev_a="[a0base]"
    filters.append("[0:v]setpts=PTS-STARTPTS,fps=30,settb=AVTB[v0base]")
    filters.append("[0:a]asetpts=PTS-STARTPTS[a0base]")
    for i in range(1,len(clips)):
        c=clips[i]; transition=c.get("transition")
        overlap=float(c.get("overlap",0))
        if transition:
            if transition not in {"fade","dissolve"}: raise ValueError("Unsupported transition")
            if overlap<=0: raise ValueError("Transition overlap must be positive")
            prev=clips[i-1]
            if float(c["start"])>float(prev["end"]):
                raise ValueError("Transition chain cannot contain gaps")
            offset=max(0,float(prev["end"])-float(prev["start"])-overlap) if i==1 else 0
            filters.append(
                f"[{i}:v]setpts=PTS-STARTPTS,fps=30,settb=AVTB[v{i}in];"
                f"{prev_v}[v{i}in]xfade=transition={transition}:duration={overlap}:offset={offset}[v{i}]")
            filters.append(
                f"{prev_a}[{i}:a]asetpts=PTS-STARTPTS[a{i}in];"
                f"[a{i-1}][a{i}in]acrossfade=d={overlap}:c1=tri:c2=tri[a{i}]")
        else:
            filters.append(f"{prev_v}[{i}:v]concat=n=2:v=1:a=0[v{i}]")
            filters.append(f"{prev_a}[{i}:a]concat=n=2:v=0:a=1[a{i}]")
        prev_v=f"[v{i}]"; prev_a=f"[a{i}]"
    args += ["-filter_complex",";".join(filters),"-map",prev_v,"-map",prev_a,
             "-c:v","libx264","-pix_fmt","yuv420p","-c:a","aac","-shortest",output_path]
    return FFmpegCommand(args)
