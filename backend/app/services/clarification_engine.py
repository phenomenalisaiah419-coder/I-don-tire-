"""Adaptive, media-aware, domain-neutral clarification engine.

Only asks questions that can materially change the edit plan. Every question has
at most four pick-list answers so the user does not need to type clarifications.
"""
from __future__ import annotations
import re
from typing import Any

MAX_OPTIONS = 4
MAX_QUESTIONS = 12

def _has_duration(p: str) -> bool:
    return bool(re.search(r"\b\d+\s*(?:s|sec|secs|second|seconds|min|minute|minutes)\b", p))

def _has_any(p: str, terms: tuple[str, ...]) -> bool:
    return any(t in p for t in terms)

def _duration_options(media: list[dict[str, Any]]) -> list[str]:
    durations = [float(m.get("duration") or m.get("durationSec") or 0) for m in media]
    total = sum(d for d in durations if d > 0)
    if total <= 0:
        return ["15 seconds", "30 seconds", "60 seconds", "90 seconds"]
    if total < 30:
        return ["10 seconds", "15 seconds", "20 seconds", "Use full length"]
    if total < 90:
        return ["15 seconds", "30 seconds", "45 seconds", "Use full length"]
    if total < 180:
        return ["30 seconds", "60 seconds", "90 seconds", "Use full length"]
    return ["30 seconds", "60 seconds", "90 seconds", "120 seconds"]

def _media_focus(media: list[dict[str, Any]]) -> list[str]:
    if len(media) <= 1:
        return ["Best moments only", "Tell a clear story", "Preserve original order", "Use everything"]
    names = [str(m.get("filename") or m.get("name") or "").strip() for m in media]
    labels = [n[:28] for n in names if n][:2]
    options = ["Best moments across all clips", "Tell a clear story", "Use all footage", "Focus on one subject"]
    if labels:
        options[3] = f"Focus on {labels[0]}"
    return options

def _media_types(media: list[dict[str, Any]]) -> tuple[bool, bool, bool]:
    videos = audios = stills = False
    for m in media:
        mime = str(m.get("mime_type") or m.get("mimeType") or "").lower()
        kind = str(m.get("type") or "").lower()
        if mime.startswith("audio/") or kind == "audio":
            audios = True
        elif mime.startswith("image/") or kind in ("image", "photo", "still"):
            stills = True
        else:
            videos = True
    return videos, audios, stills

def build_critical_questions(
    prompt: str,
    media: list[dict[str, Any]] | None = None,
    answers: dict[str, str] | None = None,
) -> list[dict[str, Any]]:
    p = prompt.lower().strip()
    media = media or []
    answers = {str(k): str(v) for k, v in (answers or {}).items() if str(v).strip()}
    questions: list[dict[str, Any]] = []

    def add(qid: str, text: str, options: list[str], needed: bool = True) -> None:
        # Never re-ask a question the user already answered. This is enforced at
        # the backend as well as the client so follow-up calls stay adaptive.
        if qid in answers:
            return
        if needed and len(questions) < MAX_QUESTIONS:
            questions.append({
                "id": qid,
                "prompt": text,
                "options": list(dict.fromkeys(options))[:MAX_OPTIONS],
                "required": True,
            })

    add("duration", "How long should the final edit be?", _duration_options(media), not _has_duration(p))

    if len(media) > 1 and "source-focus" not in answers:
        add("source-focus", "What should the edit mainly focus on?", _media_focus(media),
            not _has_any(p, ("focus on", "best moments", "all footage", "use all", "only")))

    add("purpose", "What is the main purpose of this edit?",
        ["Social / short-form", "Music / beat edit", "Story / emotional edit", "Showcase / cinematic"],
        not _has_any(p, ("tiktok", "reel", "shorts", "social", "music video", "story", "showcase", "cinematic")))

    add("pacing", "What pacing do you mean?",
        ["Fast and energetic", "Balanced", "Slow and emotional", "Build from slow to fast"],
        not _has_any(p, ("fast", "quick", "slow", "emotional", "energetic", "beat", "build")))

    add("visual-style", "Which visual direction do you want?",
        ["Cinematic", "Clean and minimal", "Stylized / dramatic", "Natural / authentic"],
        not _has_any(p, ("cinematic", "minimal", "clean", "dramatic", "stylized", "natural", "authentic")))

    add("story-focus", "What should viewers notice or feel most?",
        ["Action / energy", "Emotion / relationships", "Transformation / journey", "Personality / atmosphere"],
        not _has_any(p, ("action", "fight", "love", "romance", "emotion", "transform", "journey", "personality", "atmosphere")))

    videos, audios, stills = _media_types(media)
    if (audios or videos) and not _has_any(p, ("music", "song", "instrumental", "lyrics", "audio", "sound", "beat")):
        add("audio", "How should audio work?",
            ["Beat-synced music", "Emotional music", "Keep original audio", "Mix music + original audio"])

    # Conditional, high-impact follow-ups. They only appear after the user chooses
    # a direction where another decision materially changes the edit.
    purpose = answers.get("purpose", "").lower()
    focus = answers.get("story-focus", "").lower()
    if "music" in purpose and "audio" not in answers:
        add("music-source", "What music source should the edit use?",
            ["Use the project's music", "Use the project's original audio", "Use a beat track", "Leave music selection for later"])
    if ("story" in purpose or "emotion" in focus) and "story-structure" not in answers:
        add("story-structure", "How should the story unfold?",
            ["Chronological", "Build to a climax", "Best moments first", "Mood-driven / non-linear"])
    if "fast" in answers.get("pacing", "").lower() and "cut-density" not in answers:
        add("cut-density", "How dense should the cuts feel?",
            ["Very punchy", "Energetic but readable", "Moderate", "Let the footage decide"])

    return questions[:MAX_QUESTIONS]

def apply_answers(prompt: str, answers: dict[str, str]) -> str:
    selected = [(k, v.strip()) for k, v in answers.items() if str(v).strip()]
    if not selected:
        return prompt
    choices = "\n".join(f"- {k}: {v}" for k, v in selected)
    return f"{prompt.strip()}\n\nConfirmed choices from the user:\n{choices}\n\nTreat these choices as hard creative constraints; do not replace them with guesses."
