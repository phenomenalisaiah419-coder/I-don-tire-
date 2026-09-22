from app.services.clarification_engine import build_critical_questions


def test_vague_prompt_gets_pick_list_questions():
    questions = build_critical_questions("make me an edit", [{"filename": "clip1.mp4", "duration": 90}])
    assert 1 <= len(questions) <= 12
    assert all(1 <= len(q["options"]) <= 4 for q in questions)
    assert any(q["id"] == "duration" for q in questions)


def test_answered_questions_are_replaced_by_conditional_questions():
    media = [{"filename": "a.mp4", "duration": 90}, {"filename": "b.mp4", "duration": 90}]
    answers = {"purpose": "Music / beat edit", "pacing": "Fast and energetic"}
    questions = build_critical_questions("make me an edit", media, answers)
    ids = {q["id"] for q in questions}
    assert "purpose" not in ids
    assert "pacing" not in ids
    assert "music-source" in ids
    assert "cut-density" in ids


def test_explicit_prompt_stays_low_question():
    questions = build_critical_questions(
        "make a 60 second fast cinematic social edit with emotional music",
        [{"filename": "clip.mp4", "duration": 120}],
    )
    ids = {q["id"] for q in questions}
    assert "duration" not in ids
    assert "pacing" not in ids
    assert "visual-style" not in ids
    assert "audio" not in ids
