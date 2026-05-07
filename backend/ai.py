# this file handles all communication with the gemini api
# phase 3: structured multi-part prompt engineering layer
# phase 4: patient understanding layer — four new fields translate clinical output into plain language

import os
import json
from collections import Counter
from google import genai
from google.genai import types
from dotenv import load_dotenv
from schemas import SOAPReport
from safety import check_chat_response, append_emergency_disclaimer_if_needed, validate_soap_fields

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# --- simple in-memory caches to reduce prompt size and repeated work ---
import time
import hashlib
from typing import Optional

ENRICHED_CACHE: dict = {}
# cache entry: { key: {"reports_sig": str, "context": str, "insights": dict, "ts": float} }

SESSION_MEMORY: dict = {}
# per-session short memory store (keeps recent messages for a session)

MAX_CONTEXT_CHARS = int(os.getenv("MAX_CONTEXT_CHARS", "3000"))
MAX_SESSION_MESSAGES = int(os.getenv("MAX_SESSION_MESSAGES", "6"))


# ── prompt builder ────────────────────────────────────────────────────────────

class _Section:
    """one labeled block in a multi-part prompt"""
    def __init__(self, heading: str, body: str):
        self._text = f"[{heading}]\n{body.strip()}"

    def __str__(self) -> str:
        return self._text


def _build(*sections: _Section) -> str:
    """join sections with blank lines so the model sees clear boundaries"""
    return "\n\n".join(str(s) for s in sections)


# ── soap report generation ────────────────────────────────────────────────────

_SOAP_ROLE = _Section("ROLE", """
You are a senior clinical documentation AI and patient communication specialist.
You produce two kinds of output simultaneously: precise clinical SOAP notes for doctors,
and clear plain-language summaries for patients who have no medical training.
You do not invent clinical data. Every output field must be grounded in the inputs provided.
""")

_SOAP_FORMAT = _Section("OUTPUT FORMAT", """
Return ONLY a valid JSON object with exactly these thirteen keys:

CLINICAL FIELDS (for doctor review)
  subjective          (string)         patient-reported narrative, 2-3 sentences
  objective           (string)         measurable clinical findings, 2-3 sentences
  assessment          (string)         diagnosis with clinical reasoning, 2-3 sentences
  plan                (string)         treatment and management plan, 2-3 sentences
  diagnosis_summary   (string)         one headline sentence naming the core diagnosis
  key_symptoms        (array<string>)  5-6 most significant symptoms as short noun phrases
  risk_indicators     (array<string>)  1-4 specific warning signs. Empty array only if no risks apply.
  follow_up_actions   (array<string>)  4-5 specific actionable next steps
  patient_explanation (string)         2-3 plain English sentences for a non-medical reader

PATIENT UNDERSTANDING FIELDS (for patient portal — no jargon allowed)
  what_you_have       (string)         one sentence starting with "You have" or "You are experiencing" naming the condition in everyday words
  what_this_means     (string)         2-3 sentences explaining what the diagnosis means for the patient's daily life, activities, and how they might feel
  key_takeaways       (array<string>)  3-4 most important things the patient must remember, written as "you" statements
  questions_to_ask    (array<string>)  2-3 questions the patient should ask their doctor at the next visit

No markdown. No extra keys. No text outside the JSON object.
""")

_SOAP_CONSTRAINTS = _Section("CONSTRAINTS", """
CLINICAL CONSTRAINTS
- Do not introduce symptoms, vitals, or findings absent from the doctor input
- Do not speculate beyond what the provided data supports
- All string values must be non-empty
- key_symptoms and follow_up_actions must each contain at least 3 items
- follow_up_actions entries must be specific and actionable, not generic advice

PATIENT UNDERSTANDING CONSTRAINTS
- what_you_have must start with "You have" or "You are experiencing"
- what_this_means must mention practical impact such as activity restrictions, expected duration, or how the patient will feel
- key_takeaways must use plain language, no Latin terms, no drug-class names — say what the patient needs to do in everyday words
- questions_to_ask must be realistic questions a real patient might ask — not rhetorical or overly clinical
- None of the four patient fields may contain unexplained medical abbreviations or jargon
""")

_REQUIRED_SOAP_FIELDS = [
    "subjective", "objective", "assessment", "plan",
    "diagnosis_summary", "key_symptoms", "follow_up_actions", "patient_explanation",
    "what_you_have", "what_this_means", "key_takeaways", "questions_to_ask",
]


def _validate_soap(data: dict) -> list[str]:
    """returns the names of fields that are missing or empty"""
    problems = []
    for field in _REQUIRED_SOAP_FIELDS:
        val = data.get(field)
        if not val:
            problems.append(field)
        elif isinstance(val, list) and len(val) == 0:
            problems.append(field)
    return problems


def generate_soap_report(symptoms: str, observations: str, diagnosis: str) -> SOAPReport:
    context_body = f"""
A doctor has recorded the following patient encounter data:

Reported symptoms:     {symptoms}
Clinical observations: {observations}
Working diagnosis:     {diagnosis}
"""

    task_body = """
Generate a complete 13-field medical report as valid JSON.
Clinical fields must reflect professional documentation standards.
Patient understanding fields must translate the same clinical content into clear everyday language
that a patient with no medical background can read and immediately act on.
Both sets of fields must be internally consistent with each other.
"""

    prompt = _build(
        _SOAP_ROLE,
        _Section("CONTEXT", context_body),
        _Section("TASK", task_body),
        _SOAP_FORMAT,
        _SOAP_CONSTRAINTS,
    )

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(response_mime_type="application/json"),
    )

    data = json.loads(response.text)
    problems = _validate_soap(data)

    # one retry with an explicit repair instruction if any required fields are missing or empty
    if problems:
        repair_prompt = _build(
            _SOAP_ROLE,
            _Section("CONTEXT", context_body),
            _Section("TASK", task_body),
            _SOAP_FORMAT,
            _SOAP_CONSTRAINTS,
            _Section("REPAIR INSTRUCTION", f"""
Your previous response was missing or left empty: {', '.join(problems)}.
Return the complete JSON again with ALL thirteen fields properly filled.
Do not omit or leave empty any field.
"""),
        )
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=repair_prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json"),
        )
        data = json.loads(response.text)

    report = SOAPReport(**data)

    # phase 5: validate patient-facing fields for unsafe content before returning
    safety = validate_soap_fields(data)
    if not safety.safe:
        raise ValueError(f"soap report failed safety check: {safety.reason}")

    return report


# ── context enrichment (phase 2) ─────────────────────────────────────────────

def _to_list(val) -> list:
    if not val:
        return []
    if isinstance(val, str):
        try:
            return json.loads(val)
        except (json.JSONDecodeError, ValueError):
            return []
    return list(val)


def _fmt_date(report: dict) -> str:
    ts = report.get("created_at")
    if hasattr(ts, "strftime"):
        return ts.strftime("%b %d, %Y")
    return str(ts)[:10]


def _compact_text(value: str, limit: int = 220) -> str:
    """trim long report fields so chat prompts stay fast and predictable"""
    text = " ".join(str(value or "").split())
    if len(text) <= limit:
        return text
    return text[: limit - 3].rstrip() + "..."


def build_enriched_context(reports: list[dict]) -> str:
    """
    transforms raw reports into a compact signal-focused context block.
    detects recurring symptoms and deduplicates risks without sending full reports.
    """
    if not reports:
        return ""

    patient_name = reports[0].get("patient_name", "Unknown Patient")
    date_range = (
        f"{_fmt_date(reports[-1])} to {_fmt_date(reports[0])}"
        if len(reports) > 1
        else _fmt_date(reports[0])
    )

    symptom_freq: Counter = Counter()
    for r in reports:
        for s in _to_list(r.get("key_symptoms")):
            symptom_freq[s.lower().strip()] += 1

    recurring = sorted([s for s, n in symptom_freq.items() if n >= 2])
    recurring_set = set(recurring)
    all_symptoms_latest = _to_list(reports[0].get("key_symptoms"))
    new_this_visit = [s for s in all_symptoms_latest if s.lower().strip() not in recurring_set]

    seen_risks: set = set()
    unique_risks: list = []
    for r in reports:
        for risk in _to_list(r.get("risk_indicators")):
            key = risk.lower().strip()
            if key not in seen_risks:
                seen_risks.add(key)
                unique_risks.append(risk)

    latest_followup = _to_list(reports[0].get("follow_up_actions"))

    lines: list[str] = []
    lines.append(f"Patient: {patient_name}")
    lines.append(f"Visits: {len(reports)} | Date range: {date_range}")

    if recurring:
        lines.append(f"Recurring symptoms: {', '.join(recurring)}")

    if new_this_visit:
        lines.append(f"New symptoms in latest visit: {', '.join(new_this_visit)}")

    if unique_risks:
        lines.append(f"Warnings/risk indicators: {'; '.join(unique_risks[:5])}")

    if latest_followup:
        lines.append(f"Latest follow-up plan: {'; '.join(latest_followup[:5])}")

    lines.append("Visit timeline, oldest to newest:")
    for r in reversed(reports):
        symptoms = _to_list(r.get("key_symptoms"))
        explanation = _compact_text(r.get("patient_explanation", ""), 180)
        lines.append(f"- {_fmt_date(r)}")
        lines.append(f"  Diagnosis: {_compact_text(r.get('diagnosis_summary') or r.get('assessment', ''), 160)}")
        if symptoms:
            lines.append(f"  Symptoms: {', '.join(symptoms[:6])}")
        if explanation:
            lines.append(f"  Plain summary: {explanation}")

    latest = reports[0]
    lines.append(f"Latest assessment: {_compact_text(latest.get('assessment', ''), 260)}")
    lines.append(f"Latest treatment plan: {_compact_text(latest.get('plan', ''), 260)}")

    return "\n".join(lines)


def _reports_signature(reports: list[dict]) -> str:
    key_items = []
    for r in reports:
        rid = r.get("id") or r.get("report_id") or r.get("created_at")
        ts = r.get("created_at")
        key_items.append(f"{rid}:{str(ts)}")
    raw = "|".join(key_items)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def get_enriched_context_with_cache(reports: list[dict]) -> tuple[str, dict]:
    """Return (context_text, insights_dict) using a small cache keyed by reports signature."""
    sig = _reports_signature(reports)
    cache = ENRICHED_CACHE.get("default")
    if cache and cache.get("reports_sig") == sig:
        return cache.get("context", ""), cache.get("insights", {})

    context = build_enriched_context(reports)
    if len(context) > MAX_CONTEXT_CHARS:
        context = context[-MAX_CONTEXT_CHARS:]

    insights = extract_insights(reports)

    ENRICHED_CACHE["default"] = {"reports_sig": sig, "context": context, "insights": insights, "ts": time.time()}
    return context, insights


# ── patient chat (phase 3 prompt structure, phase 6 history + suggestions) ────

def extract_insights(reports: list[dict]) -> dict:
    """
    extracts important conditions, trends, and warnings from saved structured fields.
    this avoids an extra model call while keeping highlights grounded in stored data.
    """
    if not reports:
        return {"important_conditions": [], "trends": [], "warnings": []}

    latest = reports[0]
    important_conditions = []
    latest_condition = latest.get("what_you_have") or latest.get("diagnosis_summary")
    if latest_condition:
        important_conditions.append(latest_condition)

    for report in reports[1:]:
        condition = report.get("diagnosis_summary")
        if condition and condition not in important_conditions:
            important_conditions.append(condition)
        if len(important_conditions) >= 3:
            break

    symptom_freq: Counter = Counter()
    for report in reports:
        for symptom in _to_list(report.get("key_symptoms")):
            key = symptom.lower().strip()
            if key:
                symptom_freq[key] += 1

    recurring = [symptom for symptom, count in symptom_freq.items() if count > 1]
    trends = []
    if recurring:
        trends.append(f"Recurring symptoms across visits: {', '.join(recurring[:4])}")
    elif _to_list(latest.get("key_symptoms")):
        trends.append(f"Latest symptoms: {', '.join(_to_list(latest.get('key_symptoms'))[:4])}")

    warnings = []
    seen_warnings = set()
    for report in reports:
        for warning in _to_list(report.get("risk_indicators")):
            key = warning.lower().strip()
            if key and key not in seen_warnings:
                seen_warnings.add(key)
                warnings.append(warning)
        if len(warnings) >= 4:
            break

    if not warnings and _to_list(latest.get("follow_up_actions")):
        warnings.append(f"Follow up: {_to_list(latest.get('follow_up_actions'))[0]}")

    return {
        "important_conditions": important_conditions[:3],
        "trends": trends[:3],
        "warnings": warnings[:4],
    }


def answer_patient_question(
    question: str,
    reports: list[dict],
    history: list[dict] = None,
    session_id: str | None = None,
) -> dict:
    enriched_context, _derived_insights = get_enriched_context_with_cache(reports)
    patient_name = reports[0].get("patient_name", "the patient") if reports else "the patient"
    merged_history = []
    if session_id and session_id in SESSION_MEMORY:
        merged_history.extend(SESSION_MEMORY.get(session_id, [])[-MAX_SESSION_MESSAGES:])
    if history:
        merged_history.extend(history[-MAX_SESSION_MESSAGES:])
    short_history = merged_history[-MAX_SESSION_MESSAGES:]

    role = _Section("ROLE", f"""
You are a compassionate patient health assistant for {patient_name}.
You communicate clearly, avoid unexplained medical jargon, and never speculate beyond
what is documented in the patient's medical records.
""")

    context = _Section("CONTEXT", f"""
The following is a structured summary of {patient_name}'s medical visit history.
Recurring symptoms, risk indicators, follow-up plans, and visit timelines are included.

{enriched_context}
""")

    # include prior turns so the model can give contextually consistent follow-up answers
    history_section = None
    if short_history:
        history_lines = []
        for msg in short_history:
            label = "Patient" if msg.get("role") == "user" else "Assistant"
            history_lines.append(f"{label}: {_compact_text(msg.get('text', ''), 180)}")
        history_section = _Section("CONVERSATION HISTORY", f"""
These messages were exchanged earlier in this session.
Use them to understand what has already been asked and answered so you stay consistent
and do not repeat information the patient already received.

{chr(10).join(history_lines)}
""")

    task = _Section("TASK", f"""
Answer the following question using only the information in the context above.
Your answer must be accurate, concise, and easy for a non-medical person to understand.

Question: {question}
""")

    response_format = _Section("RESPONSE FORMAT", """
Return ONLY a valid JSON object with exactly these two keys:

  answer               (string)         your response to the patient's question in 1-3 short paragraphs.
                                         Lead with a direct answer in the first sentence.
                                         Mention recurring symptoms if relevant.
                                         Include any risk indicators that apply.
                                         Highlight a follow-up action if it directly addresses the question.

  follow_up_suggestions (array<string>) exactly 2-3 natural follow-up questions the patient would logically
                                         ask next, based on this question and answer. Each must be under
                                         12 words. Must be answerable from the available records.
                                         Do not repeat questions already in the conversation history.

No markdown. No extra keys. No text outside the JSON object.
""")

    constraints = _Section("CONSTRAINTS", """
- You MUST only use facts that appear in the context above
- If information is not in the context, set answer to exactly: "I don't have that information in your available records."
- Do not recommend treatments, medications, or dosages not documented in the records
- Do not infer a diagnosis not explicitly stated in the records
- Do not use phrases like "I think" or "possibly" unless noting a differential that appears in the records
- Do not include general medical advice ungrounded in these specific records
- Never contradict information that is present in the context
- If the question refers to "that", "it", "previous", or similar wording, resolve it from the conversation history when possible
""")

    sections = [role, context]
    if history_section:
        sections.append(history_section)
    sections += [task, response_format, constraints]

    prompt = _build(*sections)

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(response_mime_type="application/json"),
    )

    try:
        data = json.loads(response.text)
        answer = data.get("answer", "").strip()
        follow_up = data.get("follow_up_suggestions", [])
        if not isinstance(follow_up, list):
            follow_up = []
    except (json.JSONDecodeError, AttributeError):
        answer = response.text.strip()
        follow_up = []

    # phase 5: block responses that contain hallucinated or out-of-scope medical advice
    safety = check_chat_response(answer)
    if not safety.safe:
        answer = (
            "I can only answer based on information in your medical records. "
            "I wasn't able to give a reliable answer to this question from the available data. "
            "Please speak with your doctor directly."
        )
        follow_up = []

    answer = append_emergency_disclaimer_if_needed(answer)
    asked_questions = {
        msg.get("text", "").strip().lower()
        for msg in short_history
        if msg.get("role") == "user"
    }
    asked_questions.add(question.strip().lower())
    follow_up = [
        str(item).strip()
        for item in follow_up
        if str(item).strip() and str(item).strip().lower() not in asked_questions
    ][:3]

    # update short session memory with latest turn
    if session_id:
        SESSION_MEMORY.setdefault(session_id, [])
        SESSION_MEMORY[session_id].append({"role": "user", "text": question})
        SESSION_MEMORY[session_id].append({"role": "assistant", "text": answer})
        SESSION_MEMORY[session_id] = SESSION_MEMORY[session_id][-MAX_SESSION_MESSAGES:]

    return {"answer": answer, "follow_up_suggestions": follow_up}
