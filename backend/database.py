# this file handles everything related to the postgres database
# it creates the table on startup, saves reports, and retrieves recent ones

import os
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()


def get_connection():
    # open a fresh connection to neon postgres using the url from the environment
    return psycopg2.connect(os.getenv("DATABASE_URL"))


def create_tables():
    # create the reports table if it does not already exist so the server is ready on first boot
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS reports (
                    id SERIAL PRIMARY KEY,
                    subjective TEXT NOT NULL,
                    objective TEXT NOT NULL,
                    assessment TEXT NOT NULL,
                    plan TEXT NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            """)
        conn.commit()
    finally:
        conn.close()


def save_report(subjective: str, objective: str, assessment: str, plan: str) -> dict:
    # insert a new report row and return the full saved record including the generated id and timestamp
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                INSERT INTO reports (subjective, objective, assessment, plan)
                VALUES (%s, %s, %s, %s)
                RETURNING id, subjective, objective, assessment, plan, created_at
                """,
                (subjective, objective, assessment, plan),
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
                SELECT id, subjective, objective, assessment, plan, created_at
                FROM reports
                ORDER BY created_at DESC
                LIMIT %s
                """,
                (limit,),
            )
            rows = cur.fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()
