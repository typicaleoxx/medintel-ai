// this file is the doctor interface for entering patient data and generating soap reports
// progress stepper on top then session info form and a rich multi section soap preview on the right

"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import Navbar from "@/components/Navbar"
import { generateReport, saveReport, getReports } from "@/lib/api"
import type { SOAPReport, SavedReport } from "@/lib/types"

const soapSections: { key: keyof SOAPReport; label: string; desc: string; accent: string; badge: string }[] = [
  { key: "subjective", label: "Subjective", desc: "patient reported", accent: "text-violet-400", badge: "S" },
  { key: "objective", label: "Objective", desc: "clinical findings", accent: "text-teal-400", badge: "O" },
  { key: "assessment", label: "Assessment", desc: "diagnosis", accent: "text-amber-400", badge: "A" },
  { key: "plan", label: "Plan", desc: "treatment", accent: "text-emerald-400", badge: "P" },
]

// maps each input to its soap context label shown in the card header
const inputFields = [
  { key: "symptoms", label: "Patient Symptoms", short: "S", contextLabel: "Subjective Data", placeholder: "Describe the patient's reported symptoms and complaints..." },
  { key: "observations", label: "Clinical Observations", short: "O", contextLabel: "Objective Findings", placeholder: "Enter objective physical findings and vital trends..." },
  { key: "diagnosis", label: "Initial Assessment & Diagnosis", short: "A", contextLabel: "Assessment & Plan", placeholder: "Outline the diagnostic hypothesis and treatment plan..." },
]

const MAX = 1000

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
  const [lastAction, setLastAction] = useState<string | null>(null)

  // recRef holds the active speech recognition instance so we can stop it on demand
  const recRef = useRef<unknown>(null)
  // voiceBase captures the field value at the moment voice starts so we do not duplicate existing text
  const voiceBase = useRef<string>("")

  useEffect(() => {
    getReports().then((d) => setDbReports(d.reports)).catch(() => {})
  }, [])

  const values: Record<string, string> = { symptoms, observations, diagnosis }
  const setters: Record<string, (v: string) => void> = { symptoms: setSymptoms, observations: setObservations, diagnosis: setDiagnosis }

  const stageIndex = loading ? 1 : report ? 2 : 0
  const clinicalCompleteness = Math.round(
    ((patientName.trim() ? 1 : 0) + (doctorName.trim() ? 1 : 0) + (symptoms.trim() ? 1 : 0) + (observations.trim() ? 1 : 0) + (diagnosis.trim() ? 1 : 0)) / 5 * 100
  )
  const livePreview = [
    symptoms && `Subjective: ${symptoms}`,
    observations && `Objective: ${observations}`,
    diagnosis && `Assessment: ${diagnosis}`,
  ].filter(Boolean)

  const lastVisit = dbReports[0]
    ? new Date(dbReports[0].created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "no visits yet"

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
      setLastAction("Report generated and ready for review.")
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
    setLastAction(null)
    stopVoice()
  }

  const handleSave = async () => {
    if (!report) return
    setSaving(true)
    try {
      await saveReport(report, patientName, doctorName)
      setSaved(true)
      setLastAction("Report saved to this demo session.")
      getReports().then((d) => setDbReports(d.reports)).catch(() => {})
    } catch {
      setError("failed to save. please try again.")
    } finally {
      setSaving(false)
    }
  }

  const updateReportField = (key: keyof SOAPReport, value: string) => {
    setReport((current) => current ? { ...current, [key]: value } : current)
    setSaved(false)
  }

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>, setter: (v: string) => void) => {
    setter(e.target.value.slice(0, MAX))
    e.target.style.height = "auto"
    e.target.style.height = `${Math.min(e.target.scrollHeight, 220)}px`
  }

  const stopVoice = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(recRef.current as any)?.stop()
    recRef.current = null
    setListening(null)
  }

  // continuous mode so words accumulate until the user clicks the mic again to stop
  const startVoice = (fieldKey: string) => {
    if (listening === fieldKey) { stopVoice(); return }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { setError("voice input is not supported in this browser. try chrome or edge."); return }

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      let transcript = ""
      for (let i = 0; i < e.results.length; i++) transcript += e.results[i][0].transcript
      const prefix = voiceBase.current ? voiceBase.current + " " : ""
      setters[fieldKey]((prefix + transcript).slice(0, MAX))
    }
    rec.onend = () => { recRef.current = null; setListening(null) }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (e: any) => {
      recRef.current = null
      setListening(null)
      if (e.error === "not-allowed") setError("microphone access denied. allow microphone permission and try again.")
      else if (e.error !== "no-speech") setError(`voice input error: ${e.error}`)
    }

    try { rec.start() } catch {
      recRef.current = null
      setListening(null)
      setError("could not start voice input. check your microphone permissions.")
    }
  }

  return (
    <div className="min-h-screen dark:bg-[#080810] bg-gray-50 flex flex-col">
      <Navbar />

      <main className="flex-1 lg:pl-64 pt-16 w-full">
        <div className="w-full px-5 lg:px-8 py-6 flex flex-col gap-6">

        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold dark:text-white text-gray-900">Clinical Documentation</h1>
            <p className="text-sm dark:text-gray-400 text-gray-500 mt-0.5">
              Fast SOAP generation with editable AI output and session-scoped demo data.
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl dark:bg-white/5 bg-white border dark:border-white/8 border-gray-200">
            <span className="text-xs dark:text-gray-500 text-gray-400">Readiness</span>
            <span className="text-sm font-bold text-violet-500">{clinicalCompleteness}%</span>
          </div>
        </div>

        {/* three stage progress stepper */}
        <div className="dark:bg-[#0e0e1a] bg-white border dark:border-white/8 border-gray-200 rounded-xl px-6 py-4">
          <div className="flex items-center gap-0">
            {stages.map((s, i) => {
              const isDone = i < stageIndex
              const isActive = i === stageIndex
              return (
                <div key={s.label} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-1.5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                      isDone ? "bg-violet-600 text-white" : isActive
                        ? "bg-violet-600/20 border-2 border-violet-500 text-violet-400"
                        : "dark:bg-white/8 bg-gray-100 dark:text-gray-600 text-gray-400 border dark:border-white/10 border-gray-200"
                    }`}>
                      {isDone ? (
                        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-none stroke-current stroke-2">
                          <polyline points="20,6 9,17 4,12" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : s.icon}
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

        {/* stats strip */}
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

        {/* two column layout */}
        <div className="grid xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)_280px] gap-5 flex-1">

          {/* left: input form */}
          <div className="flex flex-col gap-4">

            {/* session info: patient and doctor name saved with every report */}
            <div className="dark:bg-[#0e0e1a] bg-white border dark:border-white/8 border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-violet-500 text-xs">›</span>
                <span className="text-sm font-semibold dark:text-white text-gray-900">Session Info</span>
                <span className="text-xs dark:text-gray-600 text-gray-400 dark:bg-white/5 bg-gray-100 px-2 py-0.5 rounded-full border dark:border-white/8 border-gray-200 ml-auto">required</span>
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

            {/* clinical input cards */}
            {inputFields.map(({ key, label, short, contextLabel, placeholder }) => (
              <div key={key} className="dark:bg-[#0e0e1a] bg-white border dark:border-white/8 border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-violet-600/15 border border-violet-500/20 text-violet-400 text-xs font-bold flex items-center justify-center">{short}</span>
                    <span className="text-sm font-semibold dark:text-white text-gray-900">{label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs dark:text-gray-600 text-gray-400 dark:bg-white/5 bg-gray-100 px-2 py-0.5 rounded-full border dark:border-white/8 border-gray-200">
                      {contextLabel}
                    </span>
                    <span className="text-xs dark:text-gray-500 text-gray-400">{values[key].length}/{MAX}</span>
                    <button
                      type="button"
                      onClick={() => startVoice(key)}
                      className={`transition-colors flex items-center gap-1 ${listening === key ? "text-red-400 animate-pulse" : "dark:text-gray-500 text-gray-400 dark:hover:text-white hover:text-gray-700"}`}
                      aria-label={listening === key ? "stop voice input" : "start voice input"}
                    >
                      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current stroke-2">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {listening === key && <span className="text-xs font-medium">recording</span>}
                    </button>
                  </div>
                </div>
                <textarea
                  value={values[key]}
                  onChange={(e) => handleTextareaInput(e, setters[key])}
                  placeholder={placeholder}
                  rows={3}
                  className="w-full min-h-[92px] bg-transparent text-sm dark:text-gray-300 text-gray-700 dark:placeholder-gray-600 placeholder-gray-400 resize-none focus:outline-none leading-relaxed transition-all"
                />
              </div>
            ))}

            {error && (
              <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center justify-between gap-3">
                <span>{error}</span>
                <button type="button" onClick={handleGenerate} className="text-xs font-semibold underline">retry</button>
              </div>
            )}

            {lastAction && !error && (
              <div className="px-4 py-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-500 text-sm">
                {lastAction}
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
                  <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />generating...</>
                ) : (
                  <><svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current stroke-2"><path d="M12 2l2 7h7l-5.5 4 2 7L12 16l-5.5 4 2-7L3 9h7z" strokeLinejoin="round" /></svg>Generate SOAP Report</>
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

          {/* right: rich soap report preview with all intelligence sections */}
          <div className="dark:bg-[#0e0e1a] bg-white border dark:border-white/8 border-gray-200 rounded-xl p-6 flex flex-col gap-4 overflow-y-auto min-h-[620px]">
            {!report ? (
              <div className="flex-1 flex flex-col gap-4">
                <div>
                  <h2 className="text-sm font-semibold dark:text-white text-gray-900">Live Draft Preview</h2>
                  <p className="text-xs dark:text-gray-500 text-gray-400 mt-1">A lightweight preview appears as clinical fields are filled.</p>
                </div>
                {livePreview.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    {livePreview.map((line) => (
                      <div key={line} className="dark:bg-[#080810] bg-gray-50 border dark:border-white/8 border-gray-200 rounded-xl p-4">
                        <p className="text-xs dark:text-gray-300 text-gray-600 leading-relaxed">{line}</p>
                      </div>
                    ))}
                  </div>
                ) : (
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
                )}
              </div>
            ) : (
              <>
                {/* report header */}
                <div className="flex items-center justify-between shrink-0">
                  <div>
                    <h2 className="text-sm font-semibold dark:text-white text-gray-900">SOAP Report</h2>
                    {patientName && <p className="text-xs dark:text-gray-500 text-gray-400 mt-0.5">{patientName} · {doctorName}</p>}
                  </div>
                  <span className="text-xs px-2.5 py-1 dark:bg-green-500/15 bg-green-50 dark:text-green-400 text-green-600 rounded-full border dark:border-green-500/20 border-green-200">generated</span>
                </div>

                {/* diagnosis summary: the ai headline */}
                {report.diagnosis_summary && (
                  <div className="dark:bg-violet-600/10 bg-violet-50 border dark:border-violet-500/20 border-violet-200 rounded-xl p-4 shrink-0">
                    <p className="text-xs font-bold text-violet-500 uppercase tracking-wider mb-1.5">Diagnosis Summary</p>
                    <p className="text-sm dark:text-white text-gray-900 font-medium leading-snug">{report.diagnosis_summary}</p>
                  </div>
                )}

                {/* four soap section cards */}
                <div className="grid grid-cols-2 gap-3 shrink-0">
                  {soapSections.map(({ key, label, desc, accent, badge }) => (
                    <div key={key} className="dark:bg-[#080810] bg-gray-50 rounded-xl p-4 border dark:border-white/8 border-gray-200 flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-lg dark:bg-white/8 bg-white border dark:border-white/10 border-gray-200 ${accent} text-xs font-bold flex items-center justify-center`}>{badge}</span>
                        <div>
                          <span className={`text-xs font-bold uppercase tracking-wider ${accent}`}>{label}</span>
                          <p className="text-xs dark:text-gray-500 text-gray-400">{desc}</p>
                        </div>
                      </div>
                      <textarea
                        value={report[key] as string}
                        onChange={(e) => updateReportField(key, e.target.value)}
                        rows={4}
                        className="w-full bg-transparent text-xs dark:text-gray-300 text-gray-600 leading-relaxed resize-none focus:outline-none"
                      />
                    </div>
                  ))}
                </div>

                {/* three intelligence columns: symptoms, risks, follow-up */}
                <div className="grid grid-cols-3 gap-3 shrink-0">
                  {/* key symptoms */}
                  <div className="dark:bg-[#080810] bg-gray-50 rounded-xl p-3 border dark:border-white/8 border-gray-200">
                    <p className="text-xs font-bold text-violet-400 uppercase tracking-wider mb-2">Key Symptoms</p>
                    <div className="flex flex-wrap gap-1">
                      {report.key_symptoms.map((s) => (
                        <span key={s} className="text-xs px-2 py-0.5 dark:bg-violet-500/15 bg-violet-50 dark:text-violet-300 text-violet-700 rounded-full border dark:border-violet-500/20 border-violet-200">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* risk indicators */}
                  <div className="dark:bg-[#080810] bg-gray-50 rounded-xl p-3 border dark:border-white/8 border-gray-200">
                    <p className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2">Risk Indicators</p>
                    {report.risk_indicators.length === 0 ? (
                      <p className="text-xs dark:text-gray-600 text-gray-400">none identified</p>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {report.risk_indicators.map((r, i) => (
                          <div key={i} className="flex items-start gap-1.5">
                            <span className="text-amber-400 text-xs shrink-0 mt-0.5">⚠</span>
                            <p className="text-xs dark:text-gray-300 text-gray-600 leading-snug">{r}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* follow-up actions */}
                  <div className="dark:bg-[#080810] bg-gray-50 rounded-xl p-3 border dark:border-white/8 border-gray-200">
                    <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">Follow-up</p>
                    <div className="flex flex-col gap-1.5">
                      {report.follow_up_actions.map((a, i) => (
                        <div key={i} className="flex items-start gap-1.5">
                          <span className="text-xs dark:text-emerald-400 text-emerald-600 shrink-0 mt-0.5 font-bold">{i + 1}.</span>
                          <p className="text-xs dark:text-gray-300 text-gray-600 leading-snug">{a}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* patient perspective: four plain language fields for the patient portal */}
                {(report.what_you_have || report.key_takeaways?.length > 0) && (
                  <div className="dark:bg-blue-600/10 bg-blue-50 border dark:border-blue-500/20 border-blue-200 rounded-xl p-4 shrink-0 flex flex-col gap-3">
                    <p className="text-xs font-bold text-blue-400 uppercase tracking-wider">Patient Perspective</p>
                    {report.what_you_have && (
                      <div>
                        <p className="text-xs font-semibold dark:text-white text-gray-900 leading-snug">{report.what_you_have}</p>
                        {report.what_this_means && (
                          <p className="text-xs dark:text-gray-400 text-gray-500 leading-relaxed mt-1">{report.what_this_means}</p>
                        )}
                      </div>
                    )}
                    {report.key_takeaways?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold dark:text-blue-300 text-blue-700 mb-1">Key Takeaways for Patient</p>
                        <div className="flex flex-col gap-1">
                          {report.key_takeaways.map((t, i) => (
                            <div key={i} className="flex items-start gap-1.5">
                              <span className="text-xs dark:text-blue-400 text-blue-600 shrink-0 font-bold mt-0.5">{i + 1}.</span>
                              <p className="text-xs dark:text-gray-300 text-gray-600 leading-snug">{t}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {report.questions_to_ask?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold dark:text-blue-300 text-blue-700 mb-1">Patient May Ask</p>
                        <div className="flex flex-col gap-1">
                          {report.questions_to_ask.map((q, i) => (
                            <div key={i} className="flex items-start gap-1.5">
                              <span className="text-xs dark:text-blue-400 text-blue-600 shrink-0 mt-0.5">?</span>
                              <p className="text-xs dark:text-gray-300 text-gray-600 leading-snug">{q}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* save button */}
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || saved}
                  className={`w-full py-3 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 shrink-0 ${
                    saved
                      ? "dark:bg-green-500/15 bg-green-50 dark:text-green-400 text-green-600 dark:border-green-500/20 border-green-200 border"
                      : "bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white"
                  }`}
                >
                  {saved ? "saved to session" : saving ? "saving..." : "Save Report"}
                </button>
              </>
            )}
          </div>

          <aside className="dark:bg-[#0e0e1a] bg-white border dark:border-white/8 border-gray-200 rounded-xl p-5 flex flex-col gap-4">
            <div>
              <p className="text-xs font-bold text-violet-500 uppercase tracking-wider">Insights</p>
              <h2 className="text-sm font-semibold dark:text-white text-gray-900 mt-1">Workflow Status</h2>
            </div>
            <div className="space-y-3">
              <div className="dark:bg-[#080810] bg-gray-50 border dark:border-white/8 border-gray-200 rounded-xl p-4">
                <p className="text-xs dark:text-gray-500 text-gray-400">Completion</p>
                <div className="h-2 rounded-full dark:bg-white/10 bg-gray-200 mt-2 overflow-hidden">
                  <div className="h-full bg-violet-600 transition-all" style={{ width: `${clinicalCompleteness}%` }} />
                </div>
              </div>
              <div className="dark:bg-[#080810] bg-gray-50 border dark:border-white/8 border-gray-200 rounded-xl p-4">
                <p className="text-xs dark:text-gray-500 text-gray-400 mb-2">Recording</p>
                <p className={`text-sm font-semibold ${listening ? "text-red-400" : "dark:text-gray-300 text-gray-600"}`}>
                  {listening ? "Voice capture active" : "Voice capture idle"}
                </p>
              </div>
              <div className="dark:bg-[#080810] bg-gray-50 border dark:border-white/8 border-gray-200 rounded-xl p-4">
                <p className="text-xs dark:text-gray-500 text-gray-400 mb-2">Recent activity</p>
                <p className="text-sm font-semibold dark:text-white text-gray-900">{dbReports.length} reports</p>
                <p className="text-xs dark:text-gray-500 text-gray-400 mt-1">Last visit: {lastVisit}</p>
              </div>
            </div>
          </aside>
        </div>
        </div>
      </main>

      <footer className="lg:pl-64 border-t dark:border-white/8 border-gray-200 py-4 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <span className="text-xs dark:text-gray-600 text-gray-400">MedIntel MVP — AI Clinical Documentation Platform</span>
          <span className="text-xs dark:text-gray-600 text-gray-400">Powered by Gemini · Neon · FastAPI · Next.js</span>
        </div>
      </footer>
    </div>
  )
}
