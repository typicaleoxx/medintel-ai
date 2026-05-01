# this file defines all the data shapes the api accepts and returns
# pydantic validates incoming data automatically so we never process garbage input

from datetime import datetime
from pydantic import BaseModel, Field


# what the doctor sends when requesting a report
class ReportRequest(BaseModel):
    symptoms: str = Field(..., min_length=1, max_length=2000)
    observations: str = Field(..., min_length=1, max_length=2000)
    diagnosis: str = Field(..., min_length=1, max_length=2000)


# the four sections of a standard soap note
class SOAPReport(BaseModel):
    subjective: str
    objective: str
    assessment: str
    plan: str


# what we send back to the client after generating a report
class ReportResponse(BaseModel):
    report: SOAPReport


# a report that has been persisted in the database including its id and timestamp
class SavedReport(BaseModel):
    id: int
    subjective: str
    objective: str
    assessment: str
    plan: str
    created_at: datetime


# response wrapper for a single saved report
class SaveReportResponse(BaseModel):
    report: SavedReport


# response wrapper for a list of reports shown on the patient page
class ReportsListResponse(BaseModel):
    reports: list[SavedReport]
