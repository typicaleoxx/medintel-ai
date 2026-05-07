# this file defines all the data shapes the api accepts and returns
# pydantic validates incoming data automatically so we never process garbage input

from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional


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
    key_symptoms: list[str] = Field(default_factory=list)
    risk_indicators: list[str] = Field(default_factory=list)
    follow_up_actions: list[str] = Field(default_factory=list)
    patient_explanation: str = ""
    # phase 4 patient understanding fields
    what_you_have: str = ""
    what_this_means: str = ""
    key_takeaways: list[str] = Field(default_factory=list)
    questions_to_ask: list[str] = Field(default_factory=list)


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
    key_symptoms: list[str] = Field(default_factory=list)
    risk_indicators: list[str] = Field(default_factory=list)
    follow_up_actions: list[str] = Field(default_factory=list)
    patient_explanation: str = ""
    what_you_have: str = ""
    what_this_means: str = ""
    key_takeaways: list[str] = Field(default_factory=list)
    questions_to_ask: list[str] = Field(default_factory=list)
    created_at: datetime


# response wrapper for a single saved report
class SaveReportResponse(BaseModel):
    report: SavedReport


# response wrapper for a list of reports shown on the patient page
class ReportsListResponse(BaseModel):
    reports: list[SavedReport]


# a single message in the conversation history the patient sends alongside their question
class ChatMessage(BaseModel):
    role: str
    text: str


# what the patient sends when asking a question in the chat
class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=500)
    history: list[ChatMessage] = Field(default_factory=list, max_length=8)
    session_id: Optional[str] = None


# what we send back after the ai answers the patients question
class ChatResponse(BaseModel):
    answer: str
    follow_up_suggestions: list[str] = Field(default_factory=list)


class InsightsResponse(BaseModel):
    important_conditions: list[str] = Field(default_factory=list)
    trends: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class DemoSessionRequest(BaseModel):
    session_id: str = Field(..., min_length=8, max_length=80)
    role: str = Field(..., pattern="^(doctor|patient)$")


class DemoSessionResponse(BaseModel):
    session_id: str
    role: str
    expires_at: datetime
