// this file defines shared typescript types used across the frontend

export interface SOAPReport {
  subjective: string
  objective: string
  assessment: string
  plan: string
}

export interface SavedReport extends SOAPReport {
  id: number
  patient_name: string
  doctor_name: string
  created_at: string
}
