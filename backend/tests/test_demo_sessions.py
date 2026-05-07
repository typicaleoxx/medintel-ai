from demo_sessions import create_demo_session, get_demo_reports, save_demo_report


def test_demo_sessions_are_isolated():
    create_demo_session("demo-test-a", "doctor")
    create_demo_session("demo-test-b", "patient")

    report_a = get_demo_reports("demo-test-a", limit=10)
    report_b = get_demo_reports("demo-test-b", limit=10)

    assert report_a is not None
    assert report_b is not None
    assert len(report_a) == len(report_b) == 2

    saved = save_demo_report(
        "demo-test-a",
        {
            "patient_name": "Avery Demo",
            "doctor_name": "Dr. Test",
            "subjective": "New session-only symptom.",
            "objective": "Stable exam.",
            "assessment": "Session-only assessment.",
            "plan": "Session-only plan.",
            "diagnosis_summary": "Session-only report.",
            "key_symptoms": ["session symptom"],
            "risk_indicators": [],
            "follow_up_actions": ["review session report"],
            "patient_explanation": "This report belongs only to one demo session.",
            "what_you_have": "You have a session-only demo report.",
            "what_this_means": "This should not appear in other sessions.",
            "key_takeaways": ["You should see this only in one session"],
            "questions_to_ask": ["Is this isolated?"],
        },
    )

    assert saved is not None
    assert len(get_demo_reports("demo-test-a", limit=10)) == 3
    assert len(get_demo_reports("demo-test-b", limit=10)) == 2
