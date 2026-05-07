"""Small evaluation harness for MedIntel AI behavior.

Run from the backend directory with:
    python evaluation.py

The harness uses real Gemini calls, so it requires GEMINI_API_KEY. It does not
touch the database and keeps cases synthetic for MVP safety.
"""

from dataclasses import dataclass
from typing import Callable

from ai import generate_soap_report, answer_patient_question


@dataclass
class EvaluationCase:
    name: str
    symptoms: str
    observations: str
    diagnosis: str
    expected_terms: list[str]
    chat_question: str


CASES = [
    EvaluationCase(
        name="upper respiratory infection",
        symptoms="Cough, sore throat, congestion, mild fever for two days.",
        observations="Temperature 100.4 F, lungs clear, throat mildly red, no shortness of breath.",
        diagnosis="Likely viral upper respiratory infection. Supportive care and follow-up if symptoms worsen.",
        expected_terms=["cough", "sore throat", "viral"],
        chat_question="What symptoms were recorded?",
    ),
    EvaluationCase(
        name="ankle sprain",
        symptoms="Left ankle pain and swelling after twisting ankle during basketball.",
        observations="Mild lateral swelling, able to bear weight, no deformity, range of motion limited by pain.",
        diagnosis="Mild left ankle sprain. Rest, ice, compression, elevation, and reassessment if pain worsens.",
        expected_terms=["ankle", "swelling", "sprain"],
        chat_question="What should I watch for?",
    ),
    EvaluationCase(
        name="migraine follow-up",
        symptoms="Recurring headache with light sensitivity and nausea.",
        observations="Neurologic exam normal, no fever, blood pressure within expected range.",
        diagnosis="Migraine headache without red flag neurologic findings. Track triggers and follow up if pattern changes.",
        expected_terms=["headache", "light sensitivity", "migraine"],
        chat_question="What is my diagnosis?",
    ),
]


def _contains_terms(text: str, terms: list[str]) -> bool:
    lower = text.lower()
    return all(term.lower() in lower for term in terms)


def _report_to_context(report, case: EvaluationCase) -> dict:
    return {
        "patient_name": "Evaluation Patient",
        "doctor_name": "Dr. Test",
        "subjective": report.subjective,
        "objective": report.objective,
        "assessment": report.assessment,
        "plan": report.plan,
        "diagnosis_summary": report.diagnosis_summary,
        "key_symptoms": report.key_symptoms,
        "risk_indicators": report.risk_indicators,
        "follow_up_actions": report.follow_up_actions,
        "patient_explanation": report.patient_explanation,
        "what_you_have": report.what_you_have,
        "what_this_means": report.what_this_means,
        "key_takeaways": report.key_takeaways,
        "questions_to_ask": report.questions_to_ask,
        "created_at": "2026-05-01T12:00:00Z",
    }


def evaluate_case(case: EvaluationCase, report_fn: Callable = generate_soap_report) -> dict:
    report = report_fn(case.symptoms, case.observations, case.diagnosis)
    combined_report = " ".join(
        [
            report.subjective,
            report.objective,
            report.assessment,
            report.plan,
            report.diagnosis_summary,
            report.patient_explanation,
            " ".join(report.key_symptoms),
            " ".join(report.follow_up_actions),
        ]
    )
    chat = answer_patient_question(case.chat_question, [_report_to_context(report, case)], history=[])

    checks = {
        "has_soap_sections": all([report.subjective, report.objective, report.assessment, report.plan]),
        "has_patient_fields": all([report.what_you_have, report.what_this_means, report.key_takeaways]),
        "expected_terms_present": _contains_terms(combined_report, case.expected_terms),
        "chat_answer_present": bool(chat.get("answer")),
        "chat_suggestions_present": len(chat.get("follow_up_suggestions", [])) >= 1,
        "chat_stays_uncertain_when_needed": "I don't have that information" not in chat.get("answer", "")
        or case.chat_question.lower() not in combined_report.lower(),
    }
    return {
        "case": case.name,
        "passed": all(checks.values()),
        "checks": checks,
        "answer_preview": chat.get("answer", "")[:180],
    }


def run_all() -> list[dict]:
    return [evaluate_case(case) for case in CASES]


if __name__ == "__main__":
    results = run_all()
    for result in results:
        status = "PASS" if result["passed"] else "FAIL"
        print(f"{status} {result['case']}")
        for name, passed in result["checks"].items():
            print(f"  {'ok' if passed else 'no'} {name}")
        print(f"  answer: {result['answer_preview']}")
    if not all(r["passed"] for r in results):
        raise SystemExit(1)
