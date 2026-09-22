# Timeline render-graph compiler

The shared timeline can now be compiled into a deterministic render graph.

The compiler:
- validates schema and track types
- validates timing
- orders operations
- assigns stable graph node IDs for the compiled plan
- separates video/overlay, audio and subtitle nodes

This step intentionally separates graph compilation from FFmpeg execution. The next
renderer layer can consume the compiled graph and build the final filter_complex and
maps without letting arbitrary model output become shell commands.
