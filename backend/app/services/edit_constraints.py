"""Compile user clarification answers into deterministic edit constraints."""

from __future__ import annotations

from typing import Any, Mapping


def compile_edit_constraints(
    prompt: str,
    critical_answers: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Turn explicit user choices into machine-readable editing constraints.

    Explicit selections win over inference. Unknown answers are preserved under
    ``criticalAnswers`` so providers can use them without silently discarding
    user intent.
    """
    answers = dict(critical_answers or {})
    constraints: dict[str, Any] = {
        "targetDurationMs": None,
        "style": None,
        "pacing": None,
        "storyFocus": None,
        "audioDirection": None,
        "sourceFocus": None,
        "criticalAnswers": answers,
    }

    for key, value in answers.items():
        if value is None:
            continue
        v = str(value).strip().lower()

        if key in {"duration", "target-duration", "targetDuration"}:
            m = __import__("re").search(r"(\d+)\s*(?:sec|secs|second|seconds)", v)
            if m:
                constraints["targetDurationMs"] = int(m.group(1)) * 1000
        elif key in {"style", "visual-style", "edit-style"}:
            constraints["style"] = v
        elif key in {"pacing", "pace"}:
            constraints["pacing"] = v
        elif key in {"story", "story-focus", "focus"}:
            constraints["storyFocus"] = v
        elif key in {"audio", "music", "audio-direction"}:
            constraints["audioDirection"] = v
        elif key in {"source", "source-focus", "footage"}:
            constraints["sourceFocus"] = v

    # Never invent a value when the user did not select one.
    constraints["prompt"] = prompt
    return constraints
