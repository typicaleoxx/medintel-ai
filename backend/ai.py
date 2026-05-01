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
        model="gemini-1.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
        ),
    )

    # parse the json string returned by the model into our pydantic model for type safety
    data = json.loads(response.text)

    return SOAPReport(**data)
