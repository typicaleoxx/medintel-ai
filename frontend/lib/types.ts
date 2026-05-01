// this file defines shared typescript types used across the frontend

export interface SOAPReport {
  subjective: string
  objective: string
  assessment: string
  plan: string
  diagnosis_summary: string
  key_symptoms: string[]
  risk_indicators: string[]
  follow_up_actions: string[]
  patient_explanation: string
}

export interface SavedReport extends SOAPReport {
  id: number
  patient_name: string
  doctor_name: string
  created_at: string
}
