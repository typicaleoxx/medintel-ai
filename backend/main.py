# this file is the entry point for the medintel fastapi backend
# it creates the app sets up cors so the frontend can talk to it and wires up all api routes

from contextlib import asynccontextmanager
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

from schemas import (
    ChatRequest,
    ChatResponse,
    DemoSessionRequest,
    DemoSessionResponse,
    InsightsResponse,
    ReportRequest,
    ReportResponse,
    ReportsListResponse,
    SaveReportRequest,
    SaveReportResponse,
    SavedReport,
)
from ai import generate_soap_report, answer_patient_question, extract_insights
from database import create_tables, save_report, get_recent_reports
from demo_sessions import create_demo_session, get_demo_reports, save_demo_report

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
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:8000").split(",")

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


@app.post("/api/demo/session", response_model=DemoSessionResponse)
def start_demo_session(body: DemoSessionRequest):
    return DemoSessionResponse(**create_demo_session(body.session_id, body.role))


# accepts doctor input and returns an ai generated soap report
@app.post("/api/generate-report", response_model=ReportResponse)
def generate_report(body: ReportRequest):
    # call the ai service to generate the soap report from the doctors input
    try:
        report = generate_soap_report(
            symptoms=body.symptoms,
            observations=body.observations,
            diagnosis=body.diagnosis,
        )
    except ValueError as e:
        # safety validation rejected the output — tell the client clearly
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"ai service error: {str(e)}")

    return ReportResponse(report=report)


# saves a generated soap report to the database after the doctor reviews it
@app.post("/api/save-report", response_model=SaveReportResponse)
def save_report_endpoint(body: SaveReportRequest, x_demo_session_id: str | None = Header(default=None)):
    if x_demo_session_id:
        row = save_demo_report(
            x_demo_session_id,
            {
                "patient_name": body.patient_name,
                "doctor_name": body.doctor_name,
                "subjective": body.subjective,
                "objective": body.objective,
                "assessment": body.assessment,
                "plan": body.plan,
                "diagnosis_summary": body.diagnosis_summary,
                "key_symptoms": body.key_symptoms,
                "risk_indicators": body.risk_indicators,
                "follow_up_actions": body.follow_up_actions,
                "patient_explanation": body.patient_explanation,
                "what_you_have": body.what_you_have,
                "what_this_means": body.what_this_means,
                "key_takeaways": body.key_takeaways,
                "questions_to_ask": body.questions_to_ask,
            },
        )
        if row:
            return SaveReportResponse(report=SavedReport(**row))
        raise HTTPException(status_code=404, detail="demo session expired. return to the demo entry screen.")

    # persist the patient identity and four soap sections to the reports table
    try:
        row = save_report(
            patient_name=body.patient_name,
            doctor_name=body.doctor_name,
            subjective=body.subjective,
            objective=body.objective,
            assessment=body.assessment,
            plan=body.plan,
            diagnosis_summary=body.diagnosis_summary,
            key_symptoms=body.key_symptoms,
            risk_indicators=body.risk_indicators,
            follow_up_actions=body.follow_up_actions,
            patient_explanation=body.patient_explanation,
            what_you_have=body.what_you_have,
            what_this_means=body.what_this_means,
            key_takeaways=body.key_takeaways,
            questions_to_ask=body.questions_to_ask,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"database error: {str(e)}")

    return SaveReportResponse(report=SavedReport(**row))


# returns the most recent reports so the patient page can display visit history
@app.get("/api/reports", response_model=ReportsListResponse)
def list_reports(x_demo_session_id: str | None = Header(default=None)):
    demo_rows = get_demo_reports(x_demo_session_id, limit=10)
    if demo_rows is not None:
        return ReportsListResponse(reports=[SavedReport(**r) for r in demo_rows])

    # fetch up to 10 recent reports ordered by newest first
    try:
        rows = get_recent_reports(limit=10)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"database error: {str(e)}")

    return ReportsListResponse(reports=[SavedReport(**r) for r in rows])


# handles patient questions by retrieving recent reports and answering from that context only
@app.post("/api/chat", response_model=ChatResponse)
def chat(body: ChatRequest, x_demo_session_id: str | None = Header(default=None)):
    # fetch the last N reports to keep chat grounded and prompts small per performance settings
    limit = int(os.getenv("CHAT_REPORT_LIMIT", "3"))
    demo_rows = get_demo_reports(x_demo_session_id, limit=limit)
    if demo_rows is not None:
        reports = demo_rows
    else:
        try:
            reports = get_recent_reports(limit=limit)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"database error: {str(e)}")

    # if no reports exist yet tell the patient directly instead of calling the ai
    if not reports:
        return ChatResponse(answer="no medical reports found in the system yet. please ask your doctor to generate a report first.")

    # ask the ai to answer only based on retrieved context and short session memory
    try:
        result = answer_patient_question(
            body.question,
            reports,
            history=[m.model_dump() for m in body.history[-6:]],
            session_id=body.session_id,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"ai service error: {str(e)}")

    return ChatResponse(**result)


@app.get("/api/insights", response_model=InsightsResponse)
def insights(patient_name: str | None = None, x_demo_session_id: str | None = Header(default=None)):
    demo_rows = get_demo_reports(x_demo_session_id, limit=10)
    if demo_rows is not None:
        rows = demo_rows
    else:
        try:
            rows = get_recent_reports(limit=10)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"database error: {str(e)}")

    if not rows:
        return InsightsResponse()

    insights = extract_insights(rows)

    return InsightsResponse(**insights)
