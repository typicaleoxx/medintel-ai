# this file is the entry point for the medintel fastapi backend
# it creates the app, sets up cors so the frontend can talk to it, and wires up all api routes

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

from schemas import ReportRequest, ReportResponse
from ai import generate_soap_report

# load all values from the .env file into the environment before anything else
load_dotenv()

# create the fastapi application instance with a name that shows up in the auto generated docs
app = FastAPI(title="MedIntel API", version="1.0.0")

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
