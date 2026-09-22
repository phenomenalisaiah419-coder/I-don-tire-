# Edit Plan to unified rendering

The validated Edit Plan now has an end-to-end project rendering path:

1. Validate the Edit Plan schema and capability registry.
2. Translate validated operations into a structured project render specification.
3. Route the project through the unified project renderer.
4. Produce and verify the final media output.

The translator only accepts explicitly mapped operations and tracks. It does not
invent implementations for unsupported operations.
