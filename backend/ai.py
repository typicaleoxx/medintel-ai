# this file handles all communication with the gemini api
# it builds the prompt, sends it to the model, and parses the structured response back into a soap report

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
    # build a detailed prompt that gives the model clear instructions and forces a specific output shape
    prompt = f"""you are a clinical documentation assistant helping doctors generate structured medical notes.

given the following doctor input, produce a professional soap note.

doctor input:
- symptoms reported by patient: {symptoms}
- clinical observations by doctor: {observations}
- doctor diagnosis: {diagnosis}

return a json object with exactly these four keys and no other text:
{{
  "subjective": "what the patient reported, their symptoms and history in their own words",
  "objective": "measurable clinical findings and observations noted by the doctor",
  "assessment": "the clinical interpretation and diagnosis with reasoning",
  "plan": "the recommended treatment steps, follow up, medications, and next actions"
}}

write each section as a clear professional clinical paragraph. do not use bullet points inside the values."""

    # send the prompt to gemini and request json output so the response is always parseable
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
        ),
    )

    # parse the json string returned by the model into our pydantic model for type safety
    data = json.loads(response.text)

    return SOAPReport(**data)


def answer_patient_question(question: str, reports: list[dict]) -> str:
    # format the stored reports into a readable context block for the model
    context_parts = []
    for i, r in enumerate(reports, 1):
        context_parts.append(
            f"visit {i} ({r['created_at'].strftime('%Y-%m-%d') if hasattr(r['created_at'], 'strftime') else str(r['created_at'])[:10]}):\n"
            f"subjective: {r['subjective']}\n"
            f"objective: {r['objective']}\n"
            f"assessment: {r['assessment']}\n"
            f"plan: {r['plan']}"
        )
    context = "\n\n".join(context_parts)

    # build a strict prompt that forces the model to only answer from the provided records
    prompt = f"""you are a helpful ai health assistant for a patient. you can only answer questions based on the medical records provided below. do not make up information or draw from general medical knowledge.

patient medical records:
{context}

patient question: {question}

rules:
- only answer based on the records above
- if the answer is not in the records, say you cannot find that information in the available reports
- keep your answer clear, simple, and easy for a patient to understand
- do not use medical jargon without explanation
- do not recommend treatments beyond what is already in the records"""

    # send the question and context to gemini and get a plain text response
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
    )

    return response.text.strip()
