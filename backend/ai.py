# this file handles all communication with the gemini api
# it builds the prompt, sends it to the model, and parses the structured response back into a soap report

import os
import json
import google.generativeai as genai
from dotenv import load_dotenv
from schemas import SOAPReport

# load env vars here too so the api key is available regardless of import order
load_dotenv()

# configure the gemini client once at import time using the api key from environment
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# use gemini 1.5 flash because it has a generous free tier and is fast enough for this use case
model = genai.GenerativeModel(
    model_name="gemini-1.5-flash",
    generation_config=genai.GenerationConfig(
        response_mime_type="application/json",
    ),
)


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

    # send the prompt to gemini and wait for the response
    response = model.generate_content(prompt)

    # parse the json string returned by the model into our pydantic model for type safety
    data = json.loads(response.text)

    return SOAPReport(**data)
