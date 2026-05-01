# this file handles all communication with the gemini api
# it builds prompts sends them to gemini and parses structured responses
# phase 2 adds a context enrichment layer that detects patterns across multiple visits before answering

import os
import json
from collections import Counter
from google import genai
from google.genai import types
from dotenv import load_dotenv
from schemas import SOAPReport

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))


def generate_soap_report(symptoms: str, observations: str, diagnosis: str) -> SOAPReport:
    # deep structured prompt forces clinical reasoning across all nine output fields
    prompt = f"""You are a senior clinical documentation AI with deep medical expertise. Analyze the patient data carefully and generate a comprehensive, clinically accurate medical report.

Patient Data:
- Reported symptoms: {symptoms}
- Clinical observations: {observations}
- Working diagnosis: {diagnosis}

Return ONLY valid JSON with exactly these nine fields. No markdown. No extra text.

{{
  "subjective": "Professional 2-3 sentence narrative of the patient's symptoms in their own voice, capturing onset, severity, and context",
  "objective": "Professional 2-3 sentence summary of measurable clinical findings, vitals, and examination results",
  "assessment": "Professional 2-3 sentence clinical reasoning: primary diagnosis with supporting evidence and relevant differentials",
  "plan": "Professional 2-3 sentence treatment plan: medications, interventions, monitoring frequency, and timeline",
  "diagnosis_summary": "One clear sentence stating the core diagnosis in plain terms suitable for a record header",
  "key_symptoms": ["5 to 6 most clinically significant symptoms as short noun phrases extracted from the patient data"],
  "risk_indicators": ["1 to 4 specific concrete warning signs the patient must watch for. Actionable phrases like seek emergency care if X or contact doctor immediately if Y. Use empty array only if there are genuinely zero risks."],
  "follow_up_actions": ["4 to 5 specific next steps such as schedule blood pressure recheck in 2 weeks or take prescribed antibiotic twice daily for 7 days or avoid strenuous activity for 48 hours"],
  "patient_explanation": "2 to 3 sentences explaining the diagnosis and next steps in plain English for a patient with no medical background. Be honest, clear, and reassuring."
}}"""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
        ),
    )

    data = json.loads(response.text)
    return SOAPReport(**data)


def _to_list(val) -> list:
    # normalize a field that may arrive as a python list, a json string, or none
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
    transforms raw reports into a structured context that highlights patterns.
    recurring symptoms are flagged, risks are deduplicated, and a timeline
    shows how the patients condition has evolved across visits.
    this condensed signal-focused context replaces a flat dump of raw text.
    """
    if not reports:
        return ""

    patient_name = reports[0].get("patient_name", "Unknown Patient")
    date_range = f"{_fmt_date(reports[-1])} to {_fmt_date(reports[0])}" if len(reports) > 1 else _fmt_date(reports[0])

    # count how many visits each symptom appears in to find persistent issues
    symptom_freq: Counter = Counter()
    for r in reports:
        for s in _to_list(r.get("key_symptoms")):
            symptom_freq[s.lower().strip()] += 1

    recurring = sorted([s for s, count in symptom_freq.items() if count >= 2])
    all_symptoms_latest = _to_list(reports[0].get("key_symptoms"))

    # deduplicate risk indicators across all visits — a risk noted once is still a risk
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

    lines.append(f"PATIENT: {patient_name}")
    lines.append(f"VISITS ON RECORD: {len(reports)}  |  DATE RANGE: {date_range}")

    # recurring symptoms are the most clinically important signal — highlight them first
    if recurring:
        lines.append(
            f"\nRECURRING SYMPTOMS (present in multiple visits — likely unresolved or chronic):\n  {', '.join(recurring)}"
        )

    # single symptom from latest visit that are not recurring
    new_this_visit = [s for s in all_symptoms_latest if s.lower().strip() not in set(recurring)]
    if new_this_visit:
        lines.append(f"\nNEW SYMPTOMS (current visit only):\n  {', '.join(new_this_visit)}")

    # all risk indicators deduplicated across the full visit history
    if unique_risks:
        lines.append(f"\nCUMULATIVE RISK INDICATORS (across all visits):")
        for risk in unique_risks:
            lines.append(f"  • {risk}")

    # current follow-up plan from the most recent visit
    if latest_followup:
        lines.append(f"\nCURRENT FOLLOW-UP PLAN:")
        for i, action in enumerate(latest_followup, 1):
            lines.append(f"  {i}. {action}")

    # chronological timeline so the ai can reason about progression
    lines.append(f"\nVISIT TIMELINE (oldest to newest):")
    for r in reversed(reports):
        date = _fmt_date(r)
        diagnosis = r.get("diagnosis_summary") or r.get("assessment", "")[:120]
        symptoms = _to_list(r.get("key_symptoms"))
        explanation = r.get("patient_explanation", "")

        lines.append(f"\n  [{date}]")
        lines.append(f"  Diagnosis: {diagnosis}")
        if symptoms:
            lines.append(f"  Symptoms recorded: {', '.join(symptoms)}")
        if explanation:
            lines.append(f"  Plain summary: {explanation}")

    # full clinical detail from the latest visit for depth
    latest = reports[0]
    lines.append(f"\nLATEST CLINICAL DETAILS ({_fmt_date(latest)}):")
    lines.append(f"  Full assessment: {latest.get('assessment', '')}")
    lines.append(f"  Treatment plan: {latest.get('plan', '')}")

    return "\n".join(lines)


def answer_patient_question(question: str, reports: list[dict]) -> str:
    # build an enriched context that highlights patterns instead of dumping raw text
    enriched_context = build_enriched_context(reports)
    patient_name = reports[0].get("patient_name", "the patient") if reports else "the patient"

    # prompt explicitly instructs the ai to use the pattern signals in the enriched context
    prompt = f"""You are a helpful AI health assistant for {patient_name}. Answer questions based ONLY on the structured medical context below. Do not use outside medical knowledge or make up information.

Medical Context:
{enriched_context}

Patient Question: {question}

Instructions:
- If recurring symptoms are listed and relevant to the question, mention that they have appeared across multiple visits
- Reference specific dates when it helps clarify the timeline
- If a follow-up action directly addresses what the patient is asking about, highlight it
- If a risk indicator relates to the question, make sure to mention it clearly
- Use simple plain language — no unexplained medical jargon
- If the answer is not in the context above say clearly that you cannot find that information in the available records
- Keep the answer focused and directly relevant to what was asked"""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
    )

    return response.text.strip()
