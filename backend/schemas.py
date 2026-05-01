# this file defines all the data shapes the api accepts and returns
# pydantic validates incoming data automatically so we never process garbage input

from datetime import datetime
from pydantic import BaseModel, Field


# what the doctor sends when requesting a report
class ReportRequest(BaseModel):
    symptoms: str = Field(..., min_length=1, max_length=2000)
    observations: str = Field(..., min_length=1, max_length=2000)
    diagnosis: str = Field(..., min_length=1, max_length=2000)


# the full structured output from the ai: four soap sections, five intelligence fields,
# and four patient understanding fields that translate clinical language into plain english
# all new fields default to empty so existing saved records remain valid
class SOAPReport(BaseModel):
    subjective: str
    objective: str
    assessment: str
    plan: str
    # phase 1 intelligence fields
    diagnosis_summary: str = ""
    key_symptoms: list[str] = []
    risk_indicators: list[str] = []
    follow_up_actions: list[str] = []
    patient_explanation: str = ""
    # phase 4 patient understanding fields
    what_you_have: str = ""
    what_this_means: str = ""
    key_takeaways: list[str] = []
    questions_to_ask: list[str] = []


# what we send back to the client after generating a report
class ReportResponse(BaseModel):
    report: SOAPReport


# what the doctor sends when saving a report: identity plus all soap and intelligence fields
class SaveReportRequest(SOAPReport):
    patient_name: str = Field(..., min_length=1, max_length=200)
    doctor_name: str = Field(..., min_length=1, max_length=200)


# a report that has been persisted in the database including its id and timestamp
class SavedReport(BaseModel):
    id: int
    patient_name: str
    doctor_name: str
    subjective: str
    objective: str
    assessment: str
    plan: str
    diagnosis_summary: str = ""
    key_symptoms: list[str] = []
    risk_indicators: list[str] = []
    follow_up_actions: list[str] = []
    patient_explanation: str = ""
    what_you_have: str = ""
    what_this_means: str = ""
    key_takeaways: list[str] = []
    questions_to_ask: list[str] = []
    created_at: datetime


# response wrapper for a single saved report
class SaveReportResponse(BaseModel):
    report: SavedReport


# response wrapper for a list of reports shown on the patient page
class ReportsListResponse(BaseModel):
    reports: list[SavedReport]


# what the patient sends when asking a question in the chat
class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=500)


# what we send back after the ai answers the patients question
class ChatResponse(BaseModel):
    answer: str
