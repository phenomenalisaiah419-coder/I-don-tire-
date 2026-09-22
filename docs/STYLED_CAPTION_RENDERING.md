# Styled captions and burned-in rendering

PHENOVA can now create ASS subtitle instructions with configurable font, size,
weight and outline, then burn those captions into real video through FFmpeg.

The rendering endpoint requires a real input media file and real transcript timing.
It does not mark a job complete unless FFmpeg produces an output file.

Advanced animated caption presets, per-word karaoke timing, safe-area intelligence,
and rich motion graphics remain separate future layers.
