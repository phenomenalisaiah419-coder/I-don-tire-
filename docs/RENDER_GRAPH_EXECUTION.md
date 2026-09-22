# Render graph execution

A controlled executor now consumes compiled render graphs and produces a verified FFmpeg
output for the currently supported complete path: one primary video node plus zero or
more audio nodes.

Unsupported multi-video, subtitle, or complex transition graph shapes are rejected
instead of being silently ignored. This is intentional: the graph compiler can describe
more of the editor than the verified renderer can currently execute.

The next stages expand the executor's filter graph coverage until arbitrary supported
PHENOVA projects can render end-to-end.
