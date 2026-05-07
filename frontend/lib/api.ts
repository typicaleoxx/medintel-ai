// this file contains all functions that talk to the fastapi backend
// every api call lives here so pages stay clean and we only change urls in one place

import type { ChatMessage, SOAPReport } from "./types"
import { getDemoHeaders } from "./demoSession"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

// ask the ai to generate a soap report from doctor input
export async function generateReport(
  symptoms: string,
  observations: string,
  diagnosis: string
) {
  const res = await fetch(`${API_URL}/api/generate-report`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getDemoHeaders() },
    body: JSON.stringify({ symptoms, observations, diagnosis }),
  })
  if (!res.ok) throw new Error("failed to generate report")
  return res.json()
}

// save a generated soap report to the database along with who the patient and doctor are
export async function saveReport(report: SOAPReport, patientName: string, doctorName: string) {
  const res = await fetch(`${API_URL}/api/save-report`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getDemoHeaders() },
    body: JSON.stringify({
      ...report,
      patient_name: patientName,
      doctor_name: doctorName,
    }),
  })
  if (!res.ok) throw new Error("failed to save report")
  return res.json()
}

// fetch the most recent reports for the patient page
export async function getReports() {
  const res = await fetch(`${API_URL}/api/reports`, {
    headers: getDemoHeaders(),
  })
  if (!res.ok) throw new Error("failed to fetch reports")
  return res.json()
}

// send a patient question to the ai chat endpoint
export async function chatWithAI(question: string, history: ChatMessage[] = []) {
  const res = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getDemoHeaders() },
    body: JSON.stringify({ question, history: history.slice(-6) }),
  })
  if (!res.ok) throw new Error("failed to get response")
  return res.json()
}
