# Combined transform rendering

The transform pipeline is optimized into one FFmpeg filter graph. Animated X/Y
position, scale, rotation and opacity are evaluated in the same render pass,
avoiding separate intermediate encodes for each transform.

The previous individual renderers remain available for capability isolation, while
the combined renderer is preferred when multiple transforms are requested together.
Output existence and non-zero size are verified before completion is reported.
