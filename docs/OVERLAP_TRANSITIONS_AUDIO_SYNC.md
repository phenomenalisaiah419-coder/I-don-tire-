# Overlap transitions and audio synchronization

Adjacent clips can now be rendered as a real two-input overlap transition. The same
overlap duration is applied to video `xfade` and audio `acrossfade`, keeping the
transition's audio and visual timing aligned.

Verified transition types in this renderer:
- fade
- dissolve

This is a two-clip primitive. Full timeline-wide transition chaining and arbitrary
transition families remain separate work.
