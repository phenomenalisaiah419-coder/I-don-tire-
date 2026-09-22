# Timeline editing

The timeline surface now creates explicit canonical editing operations:
- trim to selected range
- delete selected range
- move an asset between tracks/positions

These operations are not direct media mutations. They must pass through the Edit Plan
validation/execution system before media is changed, preserving the canonical project
state and auditability.
