# this file handles all communication with the gemini api
# it builds the prompt sends it to the model and parses the fully structured response

import os
import json
from google import genai
from google.genai import types
from dotenv import load_dotenv
from schemas import SOAPReport

# load env vars here too so the api key is available regardless of import order
load_dotenv()

# create the gemini client using the api key from environment
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))


def generate_soap_report(symptoms: str, observations: str, diagnosis: str) -> SOAPReport:
    # deep structured prompt that forces clinical reasoning across all nine output fields
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

    # send prompt to gemini and request json output so the response is always directly parseable
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
        ),
    )

    # parse the json string and validate it against the pydantic model for type safety
    data = json.loads(response.text)
    return SOAPReport(**data)


def answer_patient_question(question: str, reports: list[dict]) -> str:
    # build a rich context block that includes all intelligence fields not just raw soap text
    context_parts = []
    for i, r in enumerate(reports, 1):
        date_str = r["created_at"].strftime("%Y-%m-%d") if hasattr(r["created_at"], "strftime") else str(r["created_at"])[:10]

        key_symptoms = r.get("key_symptoms") or []
        risk_indicators = r.get("risk_indicators") or []
        follow_up_actions = r.get("follow_up_actions") or []

        # parse json strings if they came back as text instead of lists
        if isinstance(key_symptoms, str):
            key_symptoms = json.loads(key_symptoms)
        if isinstance(risk_indicators, str):
            risk_indicators = json.loads(risk_indicators)
        if isinstance(follow_up_actions, str):
            follow_up_actions = json.loads(follow_up_actions)

        context_parts.append(
            f"visit {i} ({date_str}) — patient: {r.get('patient_name', 'unknown')}, doctor: {r.get('doctor_name', 'unknown')}\n"
            f"diagnosis: {r.get('diagnosis_summary') or r['assessment']}\n"
            f"plain summary: {r.get('patient_explanation', '')}\n"
            f"key symptoms: {', '.join(key_symptoms) if key_symptoms else 'not recorded'}\n"
            f"risk indicators: {', '.join(risk_indicators) if risk_indicators else 'none'}\n"
            f"follow-up actions: {'; '.join(follow_up_actions) if follow_up_actions else 'not recorded'}\n"
            f"full assessment: {r['assessment']}\n"
            f"full plan: {r['plan']}"
        )
    context = "\n\n".join(context_parts)

    # strict prompt that forces the model to answer only from the provided records
    prompt = f"""You are a helpful AI health assistant for a patient. Answer only based on the medical records below. Do not invent information or use general medical knowledge.

Patient Medical Records:
{context}

Patient Question: {question}

Rules:
- Answer only from the records above
- If the answer is not in the records say you cannot find that information in the available reports
- Keep your answer clear and easy for a patient to understand
- Do not use medical jargon without explanation
- Do not recommend treatments beyond what is already in the records
- If a follow-up action or risk indicator is relevant to the question mention it"""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
    )

    return response.text.strip()
