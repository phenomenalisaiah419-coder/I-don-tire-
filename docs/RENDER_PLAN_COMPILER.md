# Step 60 — Canonical Render Plan Compiler

PHENOVA now has a dedicated Render Plan layer between Edit Plans and FFmpeg.

Flow:
Edit Plan → strict validation → Render Plan compilation → Render Plan validation
→ unified renderer → FFmpeg → output verification.

The Render Plan has schema version 2.0 and contains normalized video, audio,
overlay and subtitle nodes. Structural timeline operations cannot enter the
renderer until they have been resolved by the canonical timeline.

This reduces the chance of different callers constructing subtly different
renderer inputs and gives the backend one stable contract for future AI Director,
Flutter editor and API clients.
