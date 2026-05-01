// this file is the doctor interface for entering patient data and generating soap reports
// it has a three stage progress stepper patient and doctor name fields voice input and a live soap preview

"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import Navbar from "@/components/Navbar"
import { generateReport, saveReport, getReports } from "@/lib/api"
import type { SOAPReport, SavedReport } from "@/lib/types"

const soapSections: { key: keyof SOAPReport; label: string; desc: string; accent: string }[] = [
  { key: "subjective", label: "Subjective", desc: "patient reported", accent: "text-violet-400" },
  { key: "objective", label: "Objective", desc: "clinical findings", accent: "text-teal-400" },
  { key: "assessment", label: "Assessment", desc: "diagnosis", accent: "text-amber-400" },
  { key: "plan", label: "Plan", desc: "treatment", accent: "text-emerald-400" },
]

// input fields paired with their soap context label shown in the card header
const inputFields = [
  { key: "symptoms", label: "Patient Symptoms", contextLabel: "Subjective Data", placeholder: "Describe the patient's reported symptoms and complaints..." },
  { key: "observations", label: "Clinical Observations", contextLabel: "Objective Findings", placeholder: "Enter objective physical findings and vital trends..." },
  { key: "diagnosis", label: "Initial Assessment & Diagnosis", contextLabel: "Assessment & Plan", placeholder: "Outline the diagnostic hypothesis and treatment plan..." },
]

const MAX = 1000

// the three workflow stages shown in the progress stepper
const stages = [
  {
    label: "Clinical Input",
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current stroke-2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeLinejoin="round" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "AI Processing",
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current stroke-2">
        <path d="M12 2l2 7h7l-5.5 4 2 7L12 16l-5.5 4 2-7L3 9h7z" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "SOAP Report",
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current stroke-2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinejoin="round" />
        <polyline points="14,2 14,8 20,8" strokeLinejoin="round" />
        <line x1="16" y1="13" x2="8" y2="13" strokeLinecap="round" />
        <line x1="16" y1="17" x2="8" y2="17" strokeLinecap="round" />
      </svg>
    ),
  },
]

export default function DoctorPage() {
  const [dbReports, setDbReports] = useState<SavedReport[]>([])
  const [patientName, setPatientName] = useState("")
  const [doctorName, setDoctorName] = useState("")
  const [symptoms, setSymptoms] = useState("")
  const [observations, setObservations] = useState("")
  const [diagnosis, setDiagnosis] = useState("")
  const [report, setReport] = useState<SOAPReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [listening, setListening] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // recRef holds the active speech recognition instance so we can stop it on demand
  const recRef = useRef<unknown>(null)
  // voiceBase captures the field value at the moment voice starts so we don't duplicate existing text
  const voiceBase = useRef<string>("")

  useEffect(() => {
    getReports().then((d) => setDbReports(d.reports)).catch(() => {})
  }, [])

  const values: Record<string, string> = { symptoms, observations, diagnosis }
  const setters: Record<string, (v: string) => void> = { symptoms: setSymptoms, observations: setObservations, diagnosis: setDiagnosis }

  // stageIndex drives the progress stepper: 0 input, 1 processing, 2 report ready
  const stageIndex = loading ? 1 : report ? 2 : 0

  const lastVisit = dbReports[0]
    ? new Date(dbReports[0].created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "no visits yet"

  // group saved reports by day for the mini activity chart
  const chartData = useMemo(() => {
    const counts: Record<string, number> = {}
    dbReports.forEach((r) => {
      const day = new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      counts[day] = (counts[day] || 0) + 1
    })
    return Object.entries(counts).map(([date, count]) => ({ date, count })).slice(-7)
  }, [dbReports])

  const handleGenerate = async () => {
    if (!patientName.trim() || !doctorName.trim()) {
      setError("please enter both patient name and doctor name before generating")
      return
    }
    if (!symptoms.trim() || !observations.trim() || !diagnosis.trim()) {
      setError("please fill in all three clinical fields before generating")
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
    setPatientName("")
    setDoctorName("")
    setSymptoms("")
    setObservations("")
    setDiagnosis("")
    setReport(null)
    setSaved(false)
    setError(null)
    stopVoice()
  }

  const handleSave = async () => {
    if (!report) return
    setSaving(true)
    try {
      await saveReport(report, patientName, doctorName)
      setSaved(true)
      // refresh the stats strip so total reports and last visit update immediately
      getReports().then((d) => setDbReports(d.reports)).catch(() => {})
    } catch {
      setError("failed to save. please try again.")
    } finally {
      setSaving(false)
    }
  }

  const stopVoice = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(recRef.current as any)?.stop()
    recRef.current = null
    setListening(null)
  }

  // uses the browser speech api in continuous mode so words accumulate until the mic is clicked again
  const startVoice = (fieldKey: string) => {
    if (listening === fieldKey) {
      stopVoice()
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      setError("voice input is not supported in this browser. try chrome or edge.")
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = new SR() as any
    rec.lang = "en-US"
    rec.continuous = true
    rec.interimResults = true
    rec.maxAlternatives = 1

    recRef.current = rec
    voiceBase.current = values[fieldKey]
    setListening(fieldKey)
    setError(null)

    // accumulate all results on top of the value that existed before voice started
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      let transcript = ""
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript
      }
      const prefix = voiceBase.current ? voiceBase.current + " " : ""
      setters[fieldKey]((prefix + transcript).slice(0, MAX))
    }

    rec.onend = () => {
      recRef.current = null
      setListening(null)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (e: any) => {
      recRef.current = null
      setListening(null)
      if (e.error === "not-allowed") {
        setError("microphone access denied. allow microphone permission in your browser and try again.")
      } else if (e.error !== "no-speech") {
        setError(`voice input error: ${e.error}`)
      }
    }

    try {
      rec.start()
    } catch {
      recRef.current = null
      setListening(null)
      setError("could not start voice input. check your microphone permissions.")
    }
  }

  return (
    <div className="min-h-screen dark:bg-[#080810] bg-gray-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8 flex flex-col gap-6">

        {/* page title */}
        <div>
          <h1 className="text-2xl font-bold dark:text-white text-gray-900">Clinical Documentation</h1>
          <p className="text-sm dark:text-gray-400 text-gray-500 mt-0.5">
            Enter patient data to generate a structured SOAP report using AI.
          </p>
        </div>

        {/* three stage progress stepper showing where you are in the workflow */}
        <div className="dark:bg-[#0e0e1a] bg-white border dark:border-white/8 border-gray-200 rounded-xl px-6 py-4">
          <div className="flex items-center gap-0">
            {stages.map((s, i) => {
              const isDone = i < stageIndex
              const isActive = i === stageIndex
              return (
                <div key={s.label} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-1.5">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                        isDone
                          ? "bg-violet-600 text-white"
                          : isActive
                          ? "bg-violet-600/20 border-2 border-violet-500 text-violet-400"
                          : "dark:bg-white/8 bg-gray-100 dark:text-gray-600 text-gray-400 border dark:border-white/10 border-gray-200"
                      }`}
                    >
                      {isDone ? (
                        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-none stroke-current stroke-2">
                          <polyline points="20,6 9,17 4,12" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        s.icon
                      )}
                    </div>
                    <span className={`text-xs font-medium whitespace-nowrap ${isActive ? "dark:text-white text-gray-900" : "dark:text-gray-500 text-gray-400"}`}>
                      {s.label}
                    </span>
                  </div>
                  {i < stages.length - 1 && (
                    <div className={`flex-1 h-px mx-3 mb-5 transition-all ${isDone ? "bg-violet-600" : "dark:bg-white/10 bg-gray-200"}`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* stats strip: total reports, last visit, and a mini area chart of report activity */}
        <div className="grid grid-cols-3 gap-4">
          <div className="dark:bg-[#0e0e1a] bg-white border dark:border-white/8 border-gray-200 rounded-xl px-5 py-4 flex items-center gap-4 card-glow">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-600/20 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-violet-400 fill-none stroke-current stroke-2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinejoin="round" />
                <polyline points="14,2 14,8 20,8" strokeLinejoin="round" />
                <line x1="16" y1="13" x2="8" y2="13" strokeLinecap="round" />
                <line x1="16" y1="17" x2="8" y2="17" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <p className="text-xs dark:text-gray-500 text-gray-400">Total Reports</p>
              <p className="text-2xl font-bold dark:text-white text-gray-900">{dbReports.length}</p>
              <p className="text-xs dark:text-gray-600 text-gray-400">saved in database</p>
            </div>
          </div>

          <div className="dark:bg-[#0e0e1a] bg-white border dark:border-white/8 border-gray-200 rounded-xl px-5 py-4 flex items-center gap-4 card-glow">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500/20 to-emerald-600/20 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-teal-400 fill-none stroke-current stroke-2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeLinejoin="round" />
                <line x1="16" y1="2" x2="16" y2="6" strokeLinecap="round" />
                <line x1="8" y1="2" x2="8" y2="6" strokeLinecap="round" />
                <line x1="3" y1="10" x2="21" y2="10" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <p className="text-xs dark:text-gray-500 text-gray-400">Last Visit</p>
              <p className="text-sm font-bold dark:text-white text-gray-900 leading-tight">{lastVisit}</p>
              <p className="text-xs dark:text-gray-600 text-gray-400">most recent entry</p>
            </div>
          </div>

          {/* mini area chart showing report generation activity over time */}
          <div className="dark:bg-[#0e0e1a] bg-white border dark:border-white/8 border-gray-200 rounded-xl px-5 py-4 card-glow">
            <p className="text-xs dark:text-gray-500 text-gray-400 mb-2">Report Activity</p>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={48}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="docGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" hide />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ background: "#0e0e1a", border: "1px solid rgba(139,92,246,0.2)", borderRadius: "8px", fontSize: "11px" }}
                    labelStyle={{ color: "#9ca3af" }}
                    itemStyle={{ color: "#a78bfa" }}
                  />
                  <Area type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={2} fill="url(#docGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-12 flex items-center">
                <p className="text-xs dark:text-gray-600 text-gray-400">no data yet</p>
              </div>
            )}
          </div>
        </div>

        {/* two column layout: form left, soap preview right */}
        <div className="flex gap-5 flex-1">

          {/* left: input form */}
          <div className="flex flex-col gap-4 w-[52%]">

            {/* patient and doctor identity — saved with every report so records are never anonymous */}
            <div className="dark:bg-[#0e0e1a] bg-white border dark:border-white/8 border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-violet-500 text-xs">›</span>
                <span className="text-sm font-semibold dark:text-white text-gray-900">Session Info</span>
                <span className="text-xs dark:text-gray-600 text-gray-400 dark:bg-white/5 bg-gray-100 px-2 py-0.5 rounded-full border dark:border-white/8 border-gray-200 ml-auto">
                  required
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs dark:text-gray-500 text-gray-400 mb-1 block">Patient Name</label>
                  <input
                    type="text"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value.slice(0, 100))}
                    placeholder="Sarah Jenkins"
                    className="w-full bg-transparent text-sm dark:text-gray-300 text-gray-700 dark:placeholder-gray-600 placeholder-gray-400 focus:outline-none border-b dark:border-white/10 border-gray-200 pb-1"
                  />
                </div>
                <div>
                  <label className="text-xs dark:text-gray-500 text-gray-400 mb-1 block">Doctor Name</label>
                  <input
                    type="text"
                    value={doctorName}
                    onChange={(e) => setDoctorName(e.target.value.slice(0, 100))}
                    placeholder="Dr. Elena Rodriguez"
                    className="w-full bg-transparent text-sm dark:text-gray-300 text-gray-700 dark:placeholder-gray-600 placeholder-gray-400 focus:outline-none border-b dark:border-white/10 border-gray-200 pb-1"
                  />
                </div>
              </div>
            </div>

            {/* the three clinical input cards */}
            {inputFields.map(({ key, label, contextLabel, placeholder }) => (
              <div
                key={key}
                className="dark:bg-[#0e0e1a] bg-white border dark:border-white/8 border-gray-200 rounded-xl p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-violet-500 text-xs">›</span>
                    <span className="text-sm font-semibold dark:text-white text-gray-900">{label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs dark:text-gray-600 text-gray-400 dark:bg-white/5 bg-gray-100 px-2 py-0.5 rounded-full border dark:border-white/8 border-gray-200">
                      {contextLabel}
                    </span>
                    <span className="text-xs dark:text-gray-500 text-gray-400">
                      {values[key].length}/{MAX}
                    </span>
                    {/* mic button toggles on/off — red when recording */}
                    <button
                      type="button"
                      onClick={() => startVoice(key)}
                      className={`transition-colors ${
                        listening === key
                          ? "text-red-400 animate-pulse"
                          : "dark:text-gray-500 text-gray-400 dark:hover:text-white hover:text-gray-700"
                      }`}
                      aria-label={listening === key ? "stop voice input" : "start voice input"}
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

            {error && (
              <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-semibold text-sm transition-colors"
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

          {/* right: soap report preview */}
          <div className="flex-1 dark:bg-[#0e0e1a] bg-white border dark:border-white/8 border-gray-200 rounded-xl p-6 flex flex-col">
            {!report ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-500/15 to-purple-600/15 border border-violet-500/20 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-7 h-7 text-violet-400 fill-none stroke-current stroke-1.5">
                    <path d="M12 2l2 7h7l-5.5 4 2 7L12 16l-5.5 4 2-7L3 9h7z" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="text-sm dark:text-gray-500 text-gray-400 max-w-xs">
                  Fill in the patient data and click Generate to create a structured SOAP report.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4 h-full">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold dark:text-white text-gray-900">SOAP Report</h2>
                    {patientName && (
                      <p className="text-xs dark:text-gray-500 text-gray-400 mt-0.5">
                        {patientName} · {doctorName}
                      </p>
                    )}
                  </div>
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

      <footer className="border-t dark:border-white/8 border-gray-200 py-4 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <span className="text-xs dark:text-gray-600 text-gray-400">MedIntel MVP — AI Clinical Documentation Platform</span>
          <span className="text-xs dark:text-gray-600 text-gray-400">Powered by Gemini · Neon · FastAPI · Next.js</span>
        </div>
      </footer>
    </div>
  )
}
