# Captions and subtitles

PHENOVA can now generate exportable SRT and WebVTT subtitle data directly from
verified transcript segments.

Caption timing is never invented:
- segment IDs, timestamps and text must be supplied
- invalid timing is rejected
- empty caption text is omitted
- display-line wrapping is deterministic

This is subtitle-data generation. Full styled burned-in caption rendering remains
a separate media-rendering capability.
