# Rendered version assets

A completed correction/version is not considered rendered merely because an executor
returned successfully. The output file must exist and be fingerprinted.

The attachment step records:
- output path
- byte size
- SHA-256 fingerprint
- verification timestamp

This is the bridge between version history and actual rendered media. The canonical
FFmpeg executor remains responsible for producing the media.
