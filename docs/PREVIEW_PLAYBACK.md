# Preview and playback

The Flutter client now has a real video-player surface for network-accessible media,
including:
- play/pause
- scrubbing
- progress
- ±10 second seeking
- aspect-ratio preservation
- initialization/error states

The player does not claim that a media URL is available when the backend/storage
layer has not supplied one. Production media delivery still requires the configured
API/storage deployment.
