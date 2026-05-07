import pytest

from ai import build_enriched_context, extract_insights


def make_report(id, date, diagnosis_summary, key_symptoms, risk_indicators, follow_up_actions, patient_explanation=""):
    return {
        "id": id,
        "created_at": date,
        "diagnosis_summary": diagnosis_summary,
        "key_symptoms": key_symptoms,
        "risk_indicators": risk_indicators,
        "follow_up_actions": follow_up_actions,
        "patient_explanation": patient_explanation,
        "patient_name": "Test Patient",
    }


def test_build_enriched_context_basic():
    r1 = make_report(1, "2023-01-01", "Flu", ["fever", "cough"], ["high fever"], ["rest"] , "Feels tired")
    r2 = make_report(2, "2023-02-01", "Flu", ["cough"], [], ["follow up in 1 week"], "Still coughing")
    ctx = build_enriched_context([r2, r1])
    assert "Recurring symptoms" in ctx or "Recurring" in ctx


def test_extract_insights_simple():
    r1 = make_report(1, "2023-01-01", "Condition A", ["headache"], ["severe"], ["see specialist"]) 
    r2 = make_report(2, "2023-02-01", "Condition B", ["headache", "nausea"], [], ["monitor"]) 
    out = extract_insights([r2, r1])
    assert "important_conditions" in out
    assert isinstance(out["important_conditions"], list)
    assert "trends" in out
