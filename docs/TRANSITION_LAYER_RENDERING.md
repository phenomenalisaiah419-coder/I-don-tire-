# Transition and layer rendering

The previously defined transition/layer operations now have real FFmpeg renderers for:
- crossfade
- dissolve
- video overlay layers with opacity

Rendered outputs are checked for existence and non-zero size. More transition families,
complex multi-layer timelines, masks and keyframe-driven motion remain separate work.
