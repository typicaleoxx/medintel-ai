from copy import deepcopy
from datetime import datetime, timedelta, timezone


SESSION_TTL = timedelta(minutes=45)
_sessions: dict[str, dict] = {}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _sample_reports() -> list[dict]:
    base = _now()
    return [
        {
            "id": 2,
            "patient_name": "Avery Demo",
            "doctor_name": "Dr. Elena Rodriguez",
            "subjective": "Patient reports recurring dry cough, throat irritation, and mild fatigue over the past week. Symptoms are worse at night and improved slightly with rest and warm fluids.",
            "objective": "Temperature is mildly elevated at 99.8 F. Lungs are clear on exam, oxygen level is normal, and throat appears mildly red without signs of severe infection.",
            "assessment": "Findings are most consistent with an uncomplicated viral upper respiratory infection. No documented red flags such as shortness of breath, chest pain, or low oxygen level are present.",
            "plan": "Recommend supportive care with hydration, rest, and symptom monitoring. Patient should follow up if fever rises, breathing changes, symptoms worsen, or symptoms persist beyond the expected recovery window.",
            "diagnosis_summary": "Likely viral upper respiratory infection with cough and throat irritation.",
            "key_symptoms": ["dry cough", "throat irritation", "mild fatigue", "nighttime symptoms"],
            "risk_indicators": ["worsening fever", "new shortness of breath"],
            "follow_up_actions": ["Drink fluids regularly", "Rest and monitor symptoms", "Return if breathing changes", "Follow up if symptoms persist"],
            "patient_explanation": "You appear to have a common viral cold-like illness. Your records do not show emergency warning signs, but symptoms should be watched closely.",
            "what_you_have": "You have a likely viral upper respiratory infection.",
            "what_this_means": "This means your cough and throat irritation should usually improve with time and supportive care. You may feel tired and should avoid pushing activity until symptoms improve.",
            "key_takeaways": ["You should rest and drink fluids", "You should watch for breathing changes", "You should follow up if symptoms worsen"],
            "questions_to_ask": ["When should I return?", "What symptoms are urgent?", "How long should recovery take?"],
            "created_at": base - timedelta(days=3),
        },
        {
            "id": 1,
            "patient_name": "Avery Demo",
            "doctor_name": "Dr. Marcus Lee",
            "subjective": "Patient reports seasonal nasal congestion, sneezing, itchy eyes, and intermittent dry cough. Symptoms often occur after outdoor exposure.",
            "objective": "No fever documented. Nasal passages appear irritated, lungs are clear, and no breathing distress is recorded.",
            "assessment": "Presentation is consistent with seasonal allergic rhinitis with cough likely related to post-nasal irritation. No acute infection signs are documented in this visit.",
            "plan": "Continue avoiding known outdoor triggers when possible, monitor symptom pattern, and follow up if cough becomes persistent, fever develops, or breathing symptoms appear.",
            "diagnosis_summary": "Seasonal allergies with congestion and intermittent cough.",
            "key_symptoms": ["nasal congestion", "sneezing", "itchy eyes", "dry cough"],
            "risk_indicators": [],
            "follow_up_actions": ["Track outdoor triggers", "Avoid known triggers", "Monitor cough pattern", "Follow up if fever develops"],
            "patient_explanation": "Your symptoms fit a seasonal allergy pattern. The cough may be linked to irritation from congestion rather than a lung problem based on this record.",
            "what_you_have": "You are experiencing seasonal allergy symptoms.",
            "what_this_means": "This can make you feel congested, sneezy, and irritated after outdoor exposure. Symptoms may come and go depending on triggers.",
            "key_takeaways": ["You should track triggers", "You should monitor cough changes", "You should follow up if fever appears"],
            "questions_to_ask": ["Could allergies cause my cough?", "What triggers should I track?"],
            "created_at": base - timedelta(days=18),
        },
    ]


def create_demo_session(session_id: str, role: str) -> dict:
    cleanup_expired_sessions()
    _sessions[session_id] = {
        "role": role,
        "created_at": _now(),
        "expires_at": _now() + SESSION_TTL,
        "reports": _sample_reports(),
        "next_id": 3,
    }
    return {"session_id": session_id, "role": role, "expires_at": _sessions[session_id]["expires_at"]}


def cleanup_expired_sessions() -> None:
    now = _now()
    expired = [sid for sid, state in _sessions.items() if state["expires_at"] <= now]
    for sid in expired:
        del _sessions[sid]


def get_demo_session(session_id: str | None) -> dict | None:
    if not session_id:
        return None
    cleanup_expired_sessions()
    state = _sessions.get(session_id)
    if not state:
        return None
    state["expires_at"] = _now() + SESSION_TTL
    return state


def get_demo_reports(session_id: str | None, limit: int = 10) -> list[dict] | None:
    state = get_demo_session(session_id)
    if not state:
        return None
    reports = sorted(state["reports"], key=lambda r: r["created_at"], reverse=True)
    return deepcopy(reports[:limit])


def save_demo_report(session_id: str, report: dict) -> dict | None:
    state = get_demo_session(session_id)
    if not state:
        return None
    row = deepcopy(report)
    row["id"] = state["next_id"]
    row["created_at"] = _now()
    state["next_id"] += 1
    state["reports"].insert(0, row)
    return deepcopy(row)
