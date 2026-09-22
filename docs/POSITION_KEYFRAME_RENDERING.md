# Position keyframe rendering

Animated X/Y positioning now has a real composition-canvas renderer. Source media is
placed on a fixed transparent-capable canvas and translated according to validated
frame-time expressions.

This completes the position-keyframe renderer independently from scale/rotation.
A future combined transform compositor can apply all transforms in one filter graph
to avoid repeated encoding.
