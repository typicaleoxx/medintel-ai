// this file is the doctor interface for entering patient data and generating soap reports
// it uses a two column layout where the form is on the left and the report preview is on the right

"use client"

import { useState, useEffect } from "react"
import Navbar from "@/components/Navbar"
import { generateReport, saveReport, getReports } from "@/lib/api"
import type { SOAPReport, SavedReport } from "@/lib/types"

// each soap section with its color accent for the result cards
const soapSections: { key: keyof SOAPReport; label: string; desc: string; accent: string }[] = [
  { key: "subjective", label: "Subjective", desc: "patient reported", accent: "text-blue-400" },
  { key: "objective", label: "Objective", desc: "clinical findings", accent: "text-teal-400" },
  { key: "assessment", label: "Assessment", desc: "diagnosis", accent: "text-amber-400" },
  { key: "plan", label: "Plan", desc: "treatment", accent: "text-green-400" },
]

// the three input fields with their labels and placeholders
const inputFields = [
  { key: "symptoms", label: "Symptoms", placeholder: "Patient-reported symptoms and complaints..." },
  { key: "observations", label: "Observations", placeholder: "Clinical observations, vitals, examination findings..." },
  { key: "diagnosis", label: "Diagnosis", placeholder: "Preliminary or confirmed diagnosis..." },
]

const MAX = 1000

export default function DoctorPage() {
  const [dbReports, setDbReports] = useState<SavedReport[]>([])
  const [symptoms, setSymptoms] = useState("")
  const [observations, setObservations] = useState("")
  const [diagnosis, setDiagnosis] = useState("")
  const [report, setReport] = useState<SOAPReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [listening, setListening] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // fetch report count on load so the stats strip shows real data
  useEffect(() => {
    getReports().then((d) => setDbReports(d.reports)).catch(() => {})
  }, [])

  const values: Record<string, string> = { symptoms, observations, diagnosis }
  const setters: Record<string, (v: string) => void> = {
    symptoms: setSymptoms,
    observations: setObservations,
    diagnosis: setDiagnosis,
  }

  const lastVisit = dbReports[0]
    ? new Date(dbReports[0].created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "no visits yet"

  const handleGenerate = async () => {
    if (!symptoms.trim() || !observations.trim() || !diagnosis.trim()) {
      setError("please fill in all three fields before generating")
      return
    }
    setLoading(true)
    setError(null)
    setSaved(false)
    setReport(null)
    try {
      const data = await generateReport(symptoms, observations, diagnosis)
      setReport(data.report)
    } catch {
      setError("could not reach the backend. make sure the server is running.")
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setSymptoms("")
    setObservations("")
    setDiagnosis("")
    setReport(null)
    setSaved(false)
    setError(null)
  }

  const handleSave = async () => {
    if (!report) return
    setSaving(true)
    try {
      await saveReport(report)
      setSaved(true)
    } catch {
      setError("failed to save. please try again.")
    } finally {
      setSaving(false)
    }
  }

  // use the browser speech api to append spoken words into the target field
  const startVoice = (fieldKey: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = new SR() as any
    rec.lang = "en-US"
    rec.interimResults = false
    setListening(fieldKey)
    rec.start()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      const text = e.results[0][0].transcript
      const cur = values[fieldKey]
      setters[fieldKey](cur + (cur ? " " : "") + text)
    }
    rec.onend = () => setListening(null)
    rec.onerror = () => setListening(null)
  }

  return (
    <div className="min-h-screen dark:bg-[#080810] bg-gray-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8 flex flex-col gap-6">

        {/* page title and subtitle */}
        <div>
          <h1 className="text-2xl font-bold dark:text-white text-gray-900">Clinical Documentation</h1>
          <p className="text-sm dark:text-gray-400 text-gray-500 mt-0.5">
            Enter patient data to generate a structured SOAP report using AI.
          </p>
        </div>

        {/* stats strip showing live numbers from the database */}
        <div className="grid grid-cols-3 gap-4">
          {[
            {
              label: "Total Reports",
              value: dbReports.length.toString(),
              sub: "saved in database",
              icon: (
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-blue-400 fill-none stroke-current stroke-2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinejoin="round" />
                  <polyline points="14,2 14,8 20,8" strokeLinejoin="round" />
                  <line x1="16" y1="13" x2="8" y2="13" strokeLinecap="round" />
                  <line x1="16" y1="17" x2="8" y2="17" strokeLinecap="round" />
                </svg>
              ),
            },
            {
              label: "Last Visit",
              value: lastVisit,
              sub: "most recent entry",
              icon: (
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-teal-400 fill-none stroke-current stroke-2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeLinejoin="round" />
                  <line x1="16" y1="2" x2="16" y2="6" strokeLinecap="round" />
                  <line x1="8" y1="2" x2="8" y2="6" strokeLinecap="round" />
                  <line x1="3" y1="10" x2="21" y2="10" strokeLinecap="round" />
                </svg>
              ),
            },
            {
              label: "AI Status",
              value: "Online",
              sub: "gemini 2.5 flash",
              icon: (
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-green-400 fill-none stroke-current stroke-2">
                  <path d="M12 2l2 7h7l-5.5 4 2 7L12 16l-5.5 4 2-7L3 9h7z" strokeLinejoin="round" />
                </svg>
              ),
            },
          ].map(({ label, value, sub, icon }) => (
            <div
              key={label}
              className="dark:bg-[#0e0e1a] bg-white border dark:border-white/8 border-gray-200 rounded-xl px-5 py-4 flex items-center gap-4"
            >
              <div className="w-10 h-10 rounded-xl dark:bg-white/8 bg-gray-100 flex items-center justify-center shrink-0">
                {icon}
              </div>
              <div>
                <p className="text-xs dark:text-gray-500 text-gray-400">{label}</p>
                <p className="text-sm font-bold dark:text-white text-gray-900 leading-tight">{value}</p>
                <p className="text-xs dark:text-gray-600 text-gray-400">{sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* two column layout: form on left, preview on right */}
        <div className="flex gap-5 flex-1">

          {/* left column: input form */}
          <div className="flex flex-col gap-4 w-[52%]">

            {/* the three input cards */}
            {inputFields.map(({ key, label, placeholder }) => (
              <div
                key={key}
                className="dark:bg-[#0e0e1a] bg-white border dark:border-white/8 border-gray-200 rounded-xl p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-blue-500 text-xs">›</span>
                    <span className="text-sm font-semibold dark:text-white text-gray-900">{label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* character counter */}
                    <span className="text-xs dark:text-gray-500 text-gray-400">
                      {values[key].length}/{MAX}
                    </span>
                    {/* voice input button */}
                    <button
                      type="button"
                      onClick={() => startVoice(key)}
                      className={`transition-colors ${
                        listening === key ? "text-red-400" : "dark:text-gray-500 text-gray-400 dark:hover:text-white hover:text-gray-700"
                      }`}
                      aria-label="voice input"
                    >
                      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current stroke-2">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                </div>
                <textarea
                  value={values[key]}
                  onChange={(e) => setters[key](e.target.value.slice(0, MAX))}
                  placeholder={placeholder}
                  rows={4}
                  className="w-full bg-transparent text-sm dark:text-gray-300 text-gray-700 dark:placeholder-gray-600 placeholder-gray-400 resize-none focus:outline-none leading-relaxed"
                />
              </div>
            ))}

            {/* error message */}
            {error && (
              <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* action buttons */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-semibold text-sm transition-colors"
              >
                {loading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    generating...
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current stroke-2">
                      <path d="M12 2l2 7h7l-5.5 4 2 7L12 16l-5.5 4 2-7L3 9h7z" strokeLinejoin="round" />
                    </svg>
                    Generate SOAP Report
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="px-5 py-3 dark:bg-white/8 bg-gray-100 dark:hover:bg-white/15 hover:bg-gray-200 rounded-xl dark:text-gray-300 text-gray-600 font-medium text-sm transition-colors flex items-center gap-2"
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-none stroke-current stroke-2">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M3 3v5h5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Reset
              </button>
            </div>
          </div>

          {/* right column: soap report preview */}
          <div className="flex-1 dark:bg-[#0e0e1a] bg-white border dark:border-white/8 border-gray-200 rounded-xl p-6 flex flex-col">
            {!report ? (
              // empty state shown before a report is generated
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
                <div className="w-12 h-12 rounded-full dark:bg-white/8 bg-gray-100 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-6 h-6 dark:text-gray-500 text-gray-400 fill-none stroke-current stroke-1.5">
                    <path d="M12 2l2 7h7l-5.5 4 2 7L12 16l-5.5 4 2-7L3 9h7z" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="text-sm dark:text-gray-500 text-gray-400 max-w-xs">
                  Fill in the patient data and click Generate to create a structured SOAP report.
                </p>
              </div>
            ) : (
              // soap section cards shown after generation
              <div className="flex flex-col gap-4 h-full">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold dark:text-white text-gray-900">SOAP Report</h2>
                  <span className="text-xs px-2.5 py-1 dark:bg-green-500/15 bg-green-50 dark:text-green-400 text-green-600 rounded-full border dark:border-green-500/20 border-green-200">
                    generated
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 flex-1">
                  {soapSections.map(({ key, label, desc, accent }) => (
                    <div
                      key={key}
                      className="dark:bg-[#080810] bg-gray-50 rounded-xl p-4 border dark:border-white/8 border-gray-200 flex flex-col gap-2"
                    >
                      <div>
                        <span className={`text-xs font-bold uppercase tracking-wider ${accent}`}>{label}</span>
                        <p className="text-xs dark:text-gray-500 text-gray-400">{desc}</p>
                      </div>
                      <p className="text-xs dark:text-gray-300 text-gray-600 leading-relaxed line-clamp-5">
                        {report[key]}
                      </p>
                    </div>
                  ))}
                </div>

                {/* save button at the bottom of the preview */}
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || saved}
                  className={`w-full py-3 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 ${
                    saved
                      ? "dark:bg-green-500/15 bg-green-50 dark:text-green-400 text-green-600 dark:border-green-500/20 border-green-200 border"
                      : "bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white"
                  }`}
                >
                  {saved ? "✓ saved to database" : saving ? "saving..." : "Save Report"}
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* footer with tech stack credits */}
      <footer className="border-t dark:border-white/8 border-gray-200 py-4 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <span className="text-xs dark:text-gray-600 text-gray-400">MedIntel MVP — AI Clinical Documentation Platform</span>
          <span className="text-xs dark:text-gray-600 text-gray-400">Powered by Gemini · Neon · FastAPI · Next.js</span>
        </div>
      </footer>
    </div>
  )
}
