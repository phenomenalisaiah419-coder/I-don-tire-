from app.services.edit_constraints import compile_edit_constraints


def test_explicit_answers_become_constraints():
    c = compile_edit_constraints(
        "make an edit",
        {
            "duration": "60 seconds",
            "style": "Cinematic",
            "pacing": "Fast",
            "story-focus": "Fight",
            "audio": "Epic",
        },
    )
    assert c["targetDurationMs"] == 60000
    assert c["style"] == "cinematic"
    assert c["pacing"] == "fast"
    assert c["storyFocus"] == "fight"
    assert c["audioDirection"] == "epic"


def test_unknown_answer_is_preserved():
    c = compile_edit_constraints("make an edit", {"character-version": "Henry Cavill"})
    assert c["criticalAnswers"]["character-version"] == "Henry Cavill"
    assert c["targetDurationMs"] is None
