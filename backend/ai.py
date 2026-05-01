# this file handles all communication with the gemini api
# phase 3 introduces a structured multi part prompt engineering layer:
# every prompt has four named sections — role, context, task, constraints
# response validation with one retry ensures no incomplete soap reports reach the client

import os
import json
from collections import Counter
from google import genai
from google.genai import types
from dotenv import load_dotenv
from schemas import SOAPReport

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))


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
You are a senior clinical documentation AI with expertise in evidence-based medicine.
Your sole function is to convert raw doctor inputs into precise, professional SOAP notes.
You do not invent clinical data. Every output field must be grounded in the inputs provided.
""")

_SOAP_FORMAT = _Section("OUTPUT FORMAT", """
Return ONLY a valid JSON object with exactly these nine keys and types:

  subjective         (string)         patient-reported narrative, 2-3 sentences
  objective          (string)         measurable clinical findings, 2-3 sentences
  assessment         (string)         diagnosis with clinical reasoning, 2-3 sentences
  plan               (string)         treatment and management plan, 2-3 sentences
  diagnosis_summary  (string)         one headline sentence naming the core diagnosis
  key_symptoms       (array<string>)  5-6 most significant symptoms as short noun phrases
  risk_indicators    (array<string>)  1-4 specific warning signs. Empty array only if no risks apply.
  follow_up_actions  (array<string>)  4-5 specific actionable next steps
  patient_explanation(string)         2-3 plain English sentences for a non-medical reader

No markdown. No extra keys. No text outside the JSON object.
""")

_SOAP_CONSTRAINTS = _Section("CONSTRAINTS", """
- Do not introduce symptoms, vitals, or findings absent from the doctor input
- Do not speculate beyond what the provided data supports
- All string values must be non-empty
- key_symptoms and follow_up_actions must each contain at least 3 items
- Each follow_up_actions entry must be a specific actionable step, not generic advice
- patient_explanation must use plain language a patient with no medical training can understand
""")

# fields that must be present and non-empty in a valid soap response
_REQUIRED_SOAP_FIELDS = [
    "subjective", "objective", "assessment", "plan",
    "diagnosis_summary", "key_symptoms", "follow_up_actions", "patient_explanation",
]


def _validate_soap(data: dict) -> list[str]:
    """returns a list of field names that are missing or empty"""
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

Reported symptoms:    {symptoms}
Clinical observations: {observations}
Working diagnosis:    {diagnosis}
"""

    task_body = f"""
Generate a complete 9-field medical report as valid JSON.
Each field must be derived from the context above and internally consistent with the others.
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
Your previous response was missing or left empty the following fields: {', '.join(problems)}.
Return the complete JSON again with ALL nine fields properly filled.
Do not omit or leave empty any field.
"""),
        )
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=repair_prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json"),
        )
        data = json.loads(response.text)

    return SOAPReport(**data)


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


def build_enriched_context(reports: list[dict]) -> str:
    """
    transforms raw reports into a structured signal-focused context block.
    detects recurring symptoms, deduplicates risks, and builds a temporal timeline.
    """
    if not reports:
        return ""

    patient_name = reports[0].get("patient_name", "Unknown Patient")
    date_range = (
        f"{_fmt_date(reports[-1])} to {_fmt_date(reports[0])}"
        if len(reports) > 1
        else _fmt_date(reports[0])
    )

    # count how many visits each symptom appears in to find persistent issues
    symptom_freq: Counter = Counter()
    for r in reports:
        for s in _to_list(r.get("key_symptoms")):
            symptom_freq[s.lower().strip()] += 1

    recurring = sorted([s for s, n in symptom_freq.items() if n >= 2])
    recurring_set = set(recurring)
    all_symptoms_latest = _to_list(reports[0].get("key_symptoms"))
    new_this_visit = [s for s in all_symptoms_latest if s.lower().strip() not in recurring_set]

    # deduplicate risk indicators across all visits
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
    lines.append(f"Visits on record: {len(reports)}  |  Date range: {date_range}")

    if recurring:
        lines.append(
            f"\nRecurring symptoms across visits (likely unresolved or chronic):\n  {', '.join(recurring)}"
        )

    if new_this_visit:
        lines.append(f"\nNew symptoms (current visit only):\n  {', '.join(new_this_visit)}")

    if unique_risks:
        lines.append("\nCumulative risk indicators (across all visits):")
        for risk in unique_risks:
            lines.append(f"  • {risk}")

    if latest_followup:
        lines.append("\nCurrent follow-up plan:")
        for i, action in enumerate(latest_followup, 1):
            lines.append(f"  {i}. {action}")

    lines.append("\nVisit timeline (oldest to newest):")
    for r in reversed(reports):
        symptoms = _to_list(r.get("key_symptoms"))
        explanation = r.get("patient_explanation", "")
        lines.append(f"\n  [{_fmt_date(r)}]")
        lines.append(f"  Diagnosis: {r.get('diagnosis_summary') or r.get('assessment', '')[:120]}")
        if symptoms:
            lines.append(f"  Symptoms: {', '.join(symptoms)}")
        if explanation:
            lines.append(f"  Plain summary: {explanation}")

    latest = reports[0]
    lines.append(f"\nLatest clinical details ({_fmt_date(latest)}):")
    lines.append(f"  Assessment: {latest.get('assessment', '')}")
    lines.append(f"  Treatment plan: {latest.get('plan', '')}")

    return "\n".join(lines)


# ── patient chat ──────────────────────────────────────────────────────────────

def answer_patient_question(question: str, reports: list[dict]) -> str:
    enriched_context = build_enriched_context(reports)
    patient_name = reports[0].get("patient_name", "the patient") if reports else "the patient"

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

    task = _Section("TASK", f"""
Answer the following question using only the information in the context above.
Your answer must be accurate, concise, and easy for a non-medical person to understand.

Question: {question}
""")

    response_format = _Section("RESPONSE FORMAT", """
- Lead with a direct answer in the first sentence
- Use 1 to 3 short paragraphs
- If a recurring symptom pattern is relevant to the question, mention it explicitly
- If a risk indicator is relevant, always include it
- If a follow-up action addresses what the patient is asking, highlight it at the end
""")

    constraints = _Section("CONSTRAINTS", """
- You MUST only use facts that appear in the context above
- If information is not in the context, respond with exactly: "I don't have that information in your available records."
- Do not recommend treatments, medications, or dosages not documented in the records
- Do not infer a diagnosis not explicitly stated in the records
- Do not use phrases like "I think" or "possibly" unless noting a differential that appears in the records
- Do not include general medical advice ungrounded in these specific records
- Never contradict information that is present in the context
""")

    prompt = _build(role, context, task, response_format, constraints)

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
    )

    return response.text.strip()
