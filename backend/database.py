# this file handles everything related to the postgres database
# it creates the table on startup saves reports and retrieves recent ones

import os
import json
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()


def get_connection():
    # open a fresh connection to neon postgres using the url from the environment
    return psycopg2.connect(os.getenv("DATABASE_URL"))


def create_tables():
    # create the reports table if it does not already exist so the server is ready on first boot
    # the alter statements safely add new columns to existing databases without destroying data
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS reports (
                    id SERIAL PRIMARY KEY,
                    patient_name TEXT NOT NULL DEFAULT 'Unknown Patient',
                    doctor_name TEXT NOT NULL DEFAULT 'Unknown Doctor',
                    subjective TEXT NOT NULL,
                    objective TEXT NOT NULL,
                    assessment TEXT NOT NULL,
                    plan TEXT NOT NULL,
                    diagnosis_summary TEXT NOT NULL DEFAULT '',
                    key_symptoms JSONB NOT NULL DEFAULT '[]'::jsonb,
                    risk_indicators JSONB NOT NULL DEFAULT '[]'::jsonb,
                    follow_up_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
                    patient_explanation TEXT NOT NULL DEFAULT '',
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            """)
            # safely extend existing tables created before this migration
            cur.execute("ALTER TABLE reports ADD COLUMN IF NOT EXISTS patient_name TEXT NOT NULL DEFAULT 'Unknown Patient'")
            cur.execute("ALTER TABLE reports ADD COLUMN IF NOT EXISTS doctor_name TEXT NOT NULL DEFAULT 'Unknown Doctor'")
            cur.execute("ALTER TABLE reports ADD COLUMN IF NOT EXISTS diagnosis_summary TEXT NOT NULL DEFAULT ''")
            cur.execute("ALTER TABLE reports ADD COLUMN IF NOT EXISTS key_symptoms JSONB NOT NULL DEFAULT '[]'::jsonb")
            cur.execute("ALTER TABLE reports ADD COLUMN IF NOT EXISTS risk_indicators JSONB NOT NULL DEFAULT '[]'::jsonb")
            cur.execute("ALTER TABLE reports ADD COLUMN IF NOT EXISTS follow_up_actions JSONB NOT NULL DEFAULT '[]'::jsonb")
            cur.execute("ALTER TABLE reports ADD COLUMN IF NOT EXISTS patient_explanation TEXT NOT NULL DEFAULT ''")
            cur.execute("ALTER TABLE reports ADD COLUMN IF NOT EXISTS what_you_have TEXT NOT NULL DEFAULT ''")
            cur.execute("ALTER TABLE reports ADD COLUMN IF NOT EXISTS what_this_means TEXT NOT NULL DEFAULT ''")
            cur.execute("ALTER TABLE reports ADD COLUMN IF NOT EXISTS key_takeaways JSONB NOT NULL DEFAULT '[]'::jsonb")
            cur.execute("ALTER TABLE reports ADD COLUMN IF NOT EXISTS questions_to_ask JSONB NOT NULL DEFAULT '[]'::jsonb")
            # fill any nulls left by pre-migration rows so the app never sees null in these fields
            cur.execute("UPDATE reports SET key_symptoms = '[]'::jsonb WHERE key_symptoms IS NULL")
            cur.execute("UPDATE reports SET risk_indicators = '[]'::jsonb WHERE risk_indicators IS NULL")
            cur.execute("UPDATE reports SET follow_up_actions = '[]'::jsonb WHERE follow_up_actions IS NULL")
            cur.execute("UPDATE reports SET key_takeaways = '[]'::jsonb WHERE key_takeaways IS NULL")
            cur.execute("UPDATE reports SET questions_to_ask = '[]'::jsonb WHERE questions_to_ask IS NULL")
        conn.commit()
    finally:
        conn.close()


def save_report(
    patient_name: str,
    doctor_name: str,
    subjective: str,
    objective: str,
    assessment: str,
    plan: str,
    diagnosis_summary: str = "",
    key_symptoms: list = None,
    risk_indicators: list = None,
    follow_up_actions: list = None,
    patient_explanation: str = "",
    what_you_have: str = "",
    what_this_means: str = "",
    key_takeaways: list = None,
    questions_to_ask: list = None,
) -> dict:
    # insert a new report row and return the full saved record including the generated id and timestamp
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                INSERT INTO reports (
                    patient_name, doctor_name,
                    subjective, objective, assessment, plan,
                    diagnosis_summary, key_symptoms, risk_indicators, follow_up_actions, patient_explanation,
                    what_you_have, what_this_means, key_takeaways, questions_to_ask
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s::jsonb, %s, %s, %s, %s::jsonb, %s::jsonb)
                RETURNING
                    id, patient_name, doctor_name,
                    subjective, objective, assessment, plan,
                    diagnosis_summary, key_symptoms, risk_indicators, follow_up_actions, patient_explanation,
                    what_you_have, what_this_means, key_takeaways, questions_to_ask,
                    created_at
                """,
                (
                    patient_name, doctor_name,
                    subjective, objective, assessment, plan,
                    diagnosis_summary,
                    json.dumps(key_symptoms or []),
                    json.dumps(risk_indicators or []),
                    json.dumps(follow_up_actions or []),
                    patient_explanation,
                    what_you_have,
                    what_this_means,
                    json.dumps(key_takeaways or []),
                    json.dumps(questions_to_ask or []),
                ),
            )
            row = cur.fetchone()
        conn.commit()
        return dict(row)
    finally:
        conn.close()


def get_recent_reports(limit: int = 10) -> list[dict]:
    # fetch the most recent reports ordered by newest first so the patient sees the latest visits
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    id, patient_name, doctor_name,
                    subjective, objective, assessment, plan,
                    diagnosis_summary, key_symptoms, risk_indicators, follow_up_actions, patient_explanation,
                    what_you_have, what_this_means, key_takeaways, questions_to_ask,
                    created_at
                FROM reports
                ORDER BY created_at DESC
                LIMIT %s
                """,
                (limit,),
            )
            rows = cur.fetchall()
        # jsonb columns come back as python objects from psycopg2 so no manual parsing needed
        return [dict(r) for r in rows]
    finally:
        conn.close()
