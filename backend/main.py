# this file is the entry point for the medintel fastapi backend
# it creates the app, sets up cors so the frontend can talk to it, and wires up all api routes

from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

from schemas import ReportRequest, ReportResponse, SOAPReport, SaveReportResponse, SavedReport, ReportsListResponse
from ai import generate_soap_report
from database import create_tables, save_report, get_recent_reports

# load all values from the .env file into the environment before anything else
load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # run table creation once when the server starts so the database is always ready
    create_tables()
    yield


# create the fastapi application instance and attach the startup handler
app = FastAPI(title="MedIntel API", version="1.0.0", lifespan=lifespan)

# read allowed frontend origins from env so we can change them per environment without touching code
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

# allow the frontend to make requests to this backend by enabling cross origin resource sharing
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# simple health check endpoint so we can quickly verify the backend is up and running
@app.get("/health")
def health_check():
    return {"status": "ok"}


# accepts doctor input and returns an ai generated soap report
@app.post("/api/generate-report", response_model=ReportResponse)
def generate_report(body: ReportRequest):
    # call the ai service to generate the soap report from the doctor's input
    try:
        report = generate_soap_report(
            symptoms=body.symptoms,
            observations=body.observations,
            diagnosis=body.diagnosis,
        )
    except Exception as e:
        # surface a clean error to the client if the ai call fails for any reason
        raise HTTPException(status_code=502, detail=f"ai service error: {str(e)}")

    return ReportResponse(report=report)


# saves a generated soap report to the database after the doctor reviews it
@app.post("/api/save-report", response_model=SaveReportResponse)
def save_report_endpoint(body: SOAPReport):
    # persist the four soap sections to the reports table and return the stored record
    try:
        row = save_report(
            subjective=body.subjective,
            objective=body.objective,
            assessment=body.assessment,
            plan=body.plan,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"database error: {str(e)}")

    return SaveReportResponse(report=SavedReport(**row))


# returns the most recent reports so the patient page can display visit history
@app.get("/api/reports", response_model=ReportsListResponse)
def list_reports():
    # fetch up to 10 recent reports ordered by newest first
    try:
        rows = get_recent_reports(limit=10)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"database error: {str(e)}")

    return ReportsListResponse(reports=[SavedReport(**r) for r in rows])
