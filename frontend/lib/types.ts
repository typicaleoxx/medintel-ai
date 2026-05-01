// this file defines shared typescript types used across the frontend

export interface SOAPReport {
  subjective: string
  objective: string
  assessment: string
  plan: string
  // phase 1 intelligence fields
  diagnosis_summary: string
  key_symptoms: string[]
  risk_indicators: string[]
  follow_up_actions: string[]
  patient_explanation: string
  // phase 4 patient understanding fields
  what_you_have: string
  what_this_means: string
  key_takeaways: string[]
  questions_to_ask: string[]
}

export interface SavedReport extends SOAPReport {
  id: number
  patient_name: string
  doctor_name: string
  created_at: string
}
