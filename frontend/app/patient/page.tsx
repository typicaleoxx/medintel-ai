// this file is the patient portal — welcome hero, ai cta banner, report list, and chat panel

"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import Navbar from "@/components/Navbar"
import { getReports, chatWithAI } from "@/lib/api"
import type { ChatMessage, SavedReport } from "@/lib/types"

const suggestions = [
  "What is my diagnosis?",
  "What is my treatment plan?",
  "What symptoms were recorded?",
]

interface Insight {
  kind: "condition" | "trend" | "warning"
  label: string
  value: string
  tone: string
}

// group reports by day so the area chart shows visit frequency over time
function buildChartData(reports: SavedReport[]) {
  const counts: Record<string, number> = {}
  reports.forEach((r) => {
    const day = new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    counts[day] = (counts[day] || 0) + 1
  })
  return Object.entries(counts).map(([date, count]) => ({ date, count })).slice(-7)
}

function buildInsights(reports: SavedReport[]): Insight[] {
  if (reports.length === 0) return []

  const latest = reports[0]
  const symptomCounts: Record<string, number> = {}
  reports.forEach((report) => {
    report.key_symptoms?.forEach((symptom) => {
      const key = symptom.trim().toLowerCase()
      if (key) symptomCounts[key] = (symptomCounts[key] || 0) + 1
    })
  })

  const recurringSymptoms = Object.entries(symptomCounts)
    .filter(([, count]) => count > 1)
    .map(([symptom]) => symptom)
    .slice(0, 3)

  const insights: Insight[] = []

  const condition = latest.what_you_have || latest.diagnosis_summary
  if (condition) {
    insights.push({
      kind: "condition",
      label: "Important Condition",
      value: condition,
      tone: "dark:bg-blue-500/10 bg-blue-50 dark:border-blue-500/20 border-blue-200 dark:text-blue-300 text-blue-700",
    })
  }

  if (recurringSymptoms.length > 0) {
    insights.push({
      kind: "trend",
      label: "Trend",
      value: `Recurring symptoms across visits: ${recurringSymptoms.join(", ")}`,
      tone: "dark:bg-violet-500/10 bg-violet-50 dark:border-violet-500/20 border-violet-200 dark:text-violet-300 text-violet-700",
    })
  } else if (latest.key_symptoms?.length > 0) {
    insights.push({
      kind: "trend",
      label: "Latest Symptoms",
      value: latest.key_symptoms.slice(0, 4).join(", "),
      tone: "dark:bg-violet-500/10 bg-violet-50 dark:border-violet-500/20 border-violet-200 dark:text-violet-300 text-violet-700",
    })
  }

  if (latest.risk_indicators?.length > 0) {
    insights.push({
      kind: "warning",
      label: "Warning",
      value: latest.risk_indicators.slice(0, 2).join("; "),
      tone: "dark:bg-amber-500/10 bg-amber-50 dark:border-amber-500/20 border-amber-200 dark:text-amber-300 text-amber-700",
    })
  } else if (latest.follow_up_actions?.length > 0) {
    insights.push({
      kind: "warning",
      label: "Next Step",
      value: latest.follow_up_actions[0],
      tone: "dark:bg-emerald-500/10 bg-emerald-50 dark:border-emerald-500/20 border-emerald-200 dark:text-emerald-300 text-emerald-700",
    })
  }

  return insights.slice(0, 3)
}

export default function PatientPage() {
  const [reports, setReports] = useState<SavedReport[]>([])
  const [reportsError, setReportsError] = useState(false)
  const [selectedReport, setSelectedReport] = useState<SavedReport | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [followUpSuggestions, setFollowUpSuggestions] = useState<string[]>(suggestions)
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [simpleLanguage, setSimpleLanguage] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    getReports()
      .then((data) => setReports(data.reports))
      .catch(() => setReportsError(true))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSend = async (text?: string) => {
    const question = (text ?? input).trim()
    if (!question || sending) return
    setInput("")
    const history = messages.slice(-6)
    setMessages((prev) => [...prev, { role: "user", text: question }])
    setFollowUpSuggestions([])
    setSending(true)
    try {
      const data = await chatWithAI(question, history)
      setMessages((prev) => [...prev, { role: "assistant", text: data.answer }])
      if (Array.isArray(data.follow_up_suggestions) && data.follow_up_suggestions.length > 0) {
        setFollowUpSuggestions(data.follow_up_suggestions)
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "could not reach the backend. make sure the server is running." },
      ])
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // focus the chat input and optionally fire a starter question
  const openChat = (starterQuestion?: string) => {
    chatInputRef.current?.focus()
    if (starterQuestion && messages.length === 0) handleSend(starterQuestion)
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
  const chartData = buildChartData(reports)
  const insights = useMemo(() => buildInsights(reports), [reports])

  return (
    <div className="min-h-screen dark:bg-[#080810] bg-gray-50 flex flex-col">
      <Navbar />

      <main className="flex-1 lg:pl-64 pt-16 w-full">
        <div className="w-full px-5 lg:px-8 py-6 flex flex-col gap-6">

        {/* welcome hero strip */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold dark:text-white text-gray-900">Patient Portal</h1>
            <p className="text-sm dark:text-gray-400 text-gray-500 mt-0.5">{today}</p>
          </div>
          {reports.length > 0 && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSimpleLanguage((v) => !v)}
                className="text-xs px-3 py-1.5 dark:bg-white/8 bg-white dark:text-gray-300 text-gray-600 rounded-full border dark:border-white/10 border-gray-200 font-medium hover:border-violet-500/30 transition-colors"
              >
                {simpleLanguage ? "Simple language" : "Clinical detail"}
              </button>
              <span className="text-xs px-3 py-1.5 dark:bg-violet-500/15 bg-violet-50 dark:text-violet-400 text-violet-600 rounded-full border dark:border-violet-500/20 border-violet-200 font-medium">
                {reports.length} records on file
              </span>
            </div>
          )}
        </div>

        {/* prominent ai cta card — ensures chat is impossible to miss */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-violet-700 to-purple-800 p-6 flex items-center justify-between gap-6">
          <div className="absolute right-0 top-0 w-56 h-56 rounded-full bg-white/5 translate-x-20 -translate-y-20 pointer-events-none" />
          <div className="absolute right-28 bottom-0 w-36 h-36 rounded-full bg-white/5 translate-y-16 pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-violet-200 fill-none stroke-current stroke-2">
                <path d="M12 2l2 7h7l-5.5 4 2 7L12 16l-5.5 4 2-7L3 9h7z" strokeLinejoin="round" />
              </svg>
              <span className="text-xs font-semibold text-violet-200 uppercase tracking-wider">Smart Assistant</span>
            </div>
            <h2 className="text-xl font-bold text-white mb-1">Have questions about your reports?</h2>
            <p className="text-sm text-violet-200 max-w-md leading-relaxed">
              Our AI analyzes your medical history and provides simplified clinical insights — grounded in your actual records.
            </p>
          </div>
          <div className="relative z-10 flex flex-col gap-2 shrink-0">
            <button
              type="button"
              onClick={() => openChat("What is my diagnosis?")}
              className="flex items-center gap-2 px-5 py-2.5 bg-white text-violet-700 font-semibold text-sm rounded-xl hover:bg-violet-50 transition-colors shadow-lg shadow-violet-900/30"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current stroke-2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinejoin="round" />
              </svg>
              Ask AI Assistant
            </button>
          </div>
        </div>

        {/* stat cards — only shown when reports exist */}
        {reports.length > 0 && (() => {
          const lastDate = new Date(reports[0].created_at)
          const daysSince = Math.floor((Date.now() - lastDate.getTime()) / 86400000)
          return (
            <div className="grid grid-cols-3 gap-4">
              <div className="dark:bg-[#0e0e1a] bg-white border dark:border-white/8 border-gray-200 rounded-xl px-5 py-4 flex items-center gap-4 card-glow">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-600/20 flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 text-violet-400 fill-none stroke-current stroke-2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinejoin="round" />
                    <circle cx="9" cy="7" r="4" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs dark:text-gray-500 text-gray-400">Total Visits</p>
                  <p className="text-2xl font-bold dark:text-white text-gray-900">{reports.length}</p>
                </div>
              </div>

              <div className="dark:bg-[#0e0e1a] bg-white border dark:border-white/8 border-gray-200 rounded-xl px-5 py-4 flex items-center gap-4 card-glow">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500/20 to-emerald-600/20 flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 text-teal-400 fill-none stroke-current stroke-2">
                    <rect x="3" y="4" width="18" height="18" rx="2" strokeLinejoin="round" />
                    <line x1="16" y1="2" x2="16" y2="6" strokeLinecap="round" />
                    <line x1="8" y1="2" x2="8" y2="6" strokeLinecap="round" />
                    <line x1="3" y1="10" x2="21" y2="10" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs dark:text-gray-500 text-gray-400">Last Visit</p>
                  <p className="text-sm font-bold dark:text-white text-gray-900">
                    {lastDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                  <p className="text-xs dark:text-gray-600 text-gray-400">{daysSince === 0 ? "today" : `${daysSince}d ago`}</p>
                </div>
              </div>

              <div className="dark:bg-[#0e0e1a] bg-white border dark:border-white/8 border-gray-200 rounded-xl px-5 py-4 card-glow">
                <p className="text-xs dark:text-gray-500 text-gray-400 mb-2">Visit Activity</p>
                <ResponsiveContainer width="100%" height={48}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="visitGrad" x1="0" y1="0" x2="0" y2="1">
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
                    <Area type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={2} fill="url(#visitGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )
        })()}

        {/* instant insight highlights derived from saved report fields, no extra ai call */}
        {insights.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            {insights.map((insight) => (
              <div key={`${insight.kind}-${insight.label}`} className={`border rounded-xl px-5 py-4 ${insight.tone}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">{insight.label}</span>
                </div>
                <p className="text-sm font-semibold leading-snug line-clamp-3">{insight.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* two column layout: report list left, chat right */}
        <div className="grid xl:grid-cols-[minmax(0,1fr)_minmax(390px,0.85fr)_280px] gap-5 flex-1 min-h-0 chat-panel-height">

          {/* left: clinical reports list */}
          <div className="flex flex-col dark:bg-[#0e0e1a] bg-white border dark:border-white/8 border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b dark:border-white/8 border-gray-200 shrink-0">
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="w-4 h-4 dark:text-gray-400 text-gray-500 fill-none stroke-current stroke-2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinejoin="round" />
                  <polyline points="14,2 14,8 20,8" strokeLinejoin="round" />
                </svg>
                <span className="text-sm font-semibold dark:text-white text-gray-900">Clinical Reports</span>
              </div>
              <span className="text-xs px-2 py-0.5 dark:bg-white/10 bg-gray-100 dark:text-gray-400 text-gray-500 rounded-full">
                {reports.length} records
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
              {reportsError && (
                <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                  Could not load reports. Make sure the backend is running.
                </div>
              )}

              {!reportsError && reports.length === 0 && (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm dark:text-gray-500 text-gray-400 text-center px-6">
                    no reports yet. ask your doctor to generate one first.
                  </p>
                </div>
              )}

              {reports.map((r) => (
                <button
                  type="button"
                  key={r.id}
                  onClick={() => setSelectedReport(selectedReport?.id === r.id ? null : r)}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${
                    selectedReport?.id === r.id
                      ? "dark:bg-violet-600/15 bg-violet-50 border-violet-500/30"
                      : "dark:bg-[#080810] bg-gray-50 dark:border-white/8 border-gray-200 dark:hover:border-white/20 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg dark:bg-white/8 bg-gray-100 flex items-center justify-center shrink-0">
                        <svg viewBox="0 0 24 24" className="w-3 h-3 dark:text-gray-400 text-gray-500 fill-none stroke-current stroke-2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinejoin="round" />
                          <polyline points="14,2 14,8 20,8" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <div>
                        <span className="text-xs font-semibold dark:text-white text-gray-900 block">{r.patient_name}</span>
                        <span className="text-xs dark:text-gray-500 text-gray-400">{formatDate(r.created_at)}</span>
                      </div>
                    </div>
                    <span className="text-xs px-2 py-0.5 dark:bg-emerald-500/15 bg-emerald-50 dark:text-emerald-400 text-emerald-600 rounded-full border dark:border-emerald-500/20 border-emerald-200 font-medium uppercase tracking-wide">
                      completed
                    </span>
                  </div>
                  {(r.diagnosis_summary || r.what_you_have) && (
                    <div className="pl-8 mb-2 flex flex-wrap gap-1.5">
                      <span className="text-xs px-2 py-0.5 rounded-full dark:bg-blue-500/15 bg-blue-50 dark:text-blue-300 text-blue-700 border dark:border-blue-500/20 border-blue-200">
                        {simpleLanguage ? r.what_you_have || r.diagnosis_summary : r.diagnosis_summary || r.what_you_have}
                      </span>
                    </div>
                  )}
                  <p className="text-xs dark:text-gray-400 text-gray-500 line-clamp-2 leading-relaxed pl-8">
                    {simpleLanguage ? r.what_this_means || r.patient_explanation || r.subjective : r.subjective}
                  </p>

                  {selectedReport?.id === r.id && (
                    <div className="mt-3 pt-3 border-t dark:border-white/10 border-gray-200 flex flex-col gap-3 pl-8">
                      <p className="text-xs dark:text-gray-500 text-gray-400">Dr. {r.doctor_name}</p>

                      {/* patient understanding section — plain language, no jargon */}
                      {(r.what_you_have || r.what_this_means) && (
                        <div className="dark:bg-violet-500/10 bg-violet-50 border dark:border-violet-500/20 border-violet-200 rounded-lg p-3 flex flex-col gap-2">
                          <p className="text-xs font-bold text-violet-500 uppercase tracking-wider">{simpleLanguage ? "Your Health Summary" : "Patient Summary"}</p>
                          {r.what_you_have && (
                            <p className="text-xs font-semibold dark:text-white text-gray-900 leading-snug">{r.what_you_have}</p>
                          )}
                          {r.what_this_means && (
                            <p className="text-xs dark:text-gray-300 text-gray-600 leading-relaxed">{r.what_this_means}</p>
                          )}
                        </div>
                      )}

                      {/* key takeaways — numbered points the patient must remember */}
                      {r.key_takeaways?.length > 0 && (
                        <div className="dark:bg-[#080810] bg-gray-50 border dark:border-white/8 border-gray-200 rounded-lg p-3">
                          <p className="text-xs font-semibold dark:text-gray-400 text-gray-500 mb-1.5">Key Takeaways</p>
                          <div className="flex flex-col gap-1.5">
                            {r.key_takeaways.map((t, i) => (
                              <div key={i} className="flex items-start gap-2">
                                <span className="w-4 h-4 rounded-full bg-violet-600/20 border border-violet-500/30 text-violet-400 text-xs flex items-center justify-center shrink-0 font-bold mt-0.5">{i + 1}</span>
                                <p className="text-xs dark:text-gray-300 text-gray-600 leading-relaxed">{t}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* questions to ask at the next visit */}
                      {r.questions_to_ask?.length > 0 && (
                        <div className="dark:bg-[#080810] bg-gray-50 border dark:border-white/8 border-gray-200 rounded-lg p-3">
                          <p className="text-xs font-semibold dark:text-gray-400 text-gray-500 mb-1.5">Questions to Ask Your Doctor</p>
                          <div className="flex flex-col gap-1.5">
                            {r.questions_to_ask.map((q, i) => (
                              <div key={i} className="flex items-start gap-2">
                                <span className="text-xs dark:text-blue-400 text-blue-600 shrink-0 mt-0.5">?</span>
                                <p className="text-xs dark:text-gray-400 text-gray-500 leading-relaxed">{q}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* follow-up actions checklist */}
                      {r.follow_up_actions?.length > 0 && (
                        <div className="dark:bg-[#080810] bg-gray-50 border dark:border-white/8 border-gray-200 rounded-lg p-3">
                          <p className="text-xs font-semibold dark:text-gray-400 text-gray-500 mb-1.5">Follow-up Actions</p>
                          <div className="flex flex-col gap-1.5">
                            {r.follow_up_actions.map((a, i) => (
                              <div key={i} className="flex items-start gap-2">
                                <span className="text-xs dark:text-emerald-400 text-emerald-600 shrink-0 font-bold mt-0.5">{i + 1}.</span>
                                <p className="text-xs dark:text-gray-400 text-gray-500 leading-relaxed">{a}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* risk watch list */}
                      {r.risk_indicators?.length > 0 && (
                        <div className="dark:bg-amber-500/10 bg-amber-50 border dark:border-amber-500/20 border-amber-200 rounded-lg p-3">
                          <p className="text-xs font-semibold dark:text-amber-400 text-amber-600 mb-1.5">Watch For</p>
                          <div className="flex flex-col gap-1.5">
                            {r.risk_indicators.map((risk, i) => (
                              <div key={i} className="flex items-start gap-2">
                                <span className="text-xs dark:text-amber-400 text-amber-600 shrink-0 mt-0.5">⚠</span>
                                <p className="text-xs dark:text-gray-400 text-gray-500 leading-relaxed">{risk}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* right: ai chat panel */}
          <div className="flex flex-col dark:bg-[#0e0e1a] bg-white border dark:border-white/8 border-gray-200 rounded-xl overflow-hidden">

            <div className="flex items-center justify-between px-5 py-4 border-b dark:border-white/8 border-gray-200 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500/20 to-purple-600/20 border border-violet-500/30 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 text-violet-400 fill-none stroke-current stroke-2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold dark:text-white text-gray-900">AI Health Assistant</p>
                  <p className="text-xs dark:text-gray-500 text-gray-400">Answers based on your medical history only</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs dark:text-gray-400 text-gray-500">Online</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
              {messages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-500/20 to-purple-600/20 border border-violet-500/20 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-7 h-7 text-violet-400 fill-none stroke-current stroke-1.5">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium dark:text-white text-gray-900">Ask about your health records</p>
                    <p className="text-xs dark:text-gray-500 text-gray-400 mt-1">
                      I can only answer based on your stored medical reports.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 mt-1">
                    {followUpSuggestions.map((s) => (
                      <button
                        type="button"
                        key={s}
                        onClick={() => handleSend(s)}
                        className="px-3 py-1.5 text-xs dark:bg-white/8 bg-gray-100 dark:hover:bg-violet-500/15 hover:bg-violet-50 dark:text-gray-300 text-gray-600 dark:hover:text-violet-300 hover:text-violet-700 rounded-full border dark:border-white/10 border-gray-200 dark:hover:border-violet-500/30 hover:border-violet-200 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                          m.role === "user"
                            ? "bg-violet-600 text-white rounded-br-sm"
                            : "dark:bg-[#080810] bg-gray-100 dark:text-gray-300 text-gray-700 rounded-bl-sm dark:border-white/8 border-gray-200 border"
                        }`}
                      >
                        {m.text}
                      </div>
                    </div>
                  ))}
                  {!sending && followUpSuggestions.length > 0 && (
                    <div className="flex flex-wrap gap-2 pl-1">
                      {followUpSuggestions.map((s) => (
                        <button
                          type="button"
                          key={s}
                          onClick={() => handleSend(s)}
                          className="px-3 py-1.5 text-xs dark:bg-white/8 bg-gray-100 dark:hover:bg-violet-500/15 hover:bg-violet-50 dark:text-gray-300 text-gray-600 dark:hover:text-violet-300 hover:text-violet-700 rounded-full border dark:border-white/10 border-gray-200 dark:hover:border-violet-500/30 hover:border-violet-200 transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                  {sending && (
                    <div className="flex justify-start">
                      <div className="dark:bg-[#080810] bg-gray-100 dark:border-white/8 border-gray-200 border px-4 py-3 rounded-2xl rounded-bl-sm flex gap-1 items-center">
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className={`w-1.5 h-1.5 rounded-full dark:bg-gray-500 bg-gray-400 animate-bounce bounce-delay-${i}`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  <div ref={bottomRef} />
                </>
              )}
            </div>

            <div className="px-4 py-4 border-t dark:border-white/8 border-gray-200 shrink-0">
              <div className="flex items-end gap-3 dark:bg-[#080810] bg-gray-50 border dark:border-white/10 border-gray-200 rounded-xl px-4 py-3">
                <textarea
                  ref={chatInputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value.slice(0, 500))}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about your health records..."
                  rows={1}
                  className="flex-1 bg-transparent text-sm dark:text-white text-gray-900 dark:placeholder-gray-600 placeholder-gray-400 resize-none focus:outline-none leading-relaxed"
                />
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs dark:text-gray-600 text-gray-400">{input.length}/500</span>
                  <button
                    type="button"
                    onClick={() => handleSend()}
                    disabled={!input.trim() || sending}
                    aria-label="send message"
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                  >
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-white fill-none stroke-current stroke-2">
                      <line x1="22" y1="2" x2="11" y2="13" strokeLinecap="round" />
                      <polygon points="22,2 15,22 11,13 2,9" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <aside className="dark:bg-[#0e0e1a] bg-white border dark:border-white/8 border-gray-200 rounded-xl p-5 flex flex-col gap-4 overflow-y-auto">
            <div>
              <p className="text-xs font-bold text-violet-500 uppercase tracking-wider">Care Snapshot</p>
              <h2 className="text-sm font-semibold dark:text-white text-gray-900 mt-1">Important Signals</h2>
            </div>
            {insights.length > 0 ? (
              <div className="flex flex-col gap-3">
                {insights.map((insight) => (
                  <div key={`rail-${insight.kind}-${insight.label}`} className={`border rounded-xl p-4 ${insight.tone}`}>
                    <p className="text-xs font-bold uppercase tracking-wider mb-1">{insight.label}</p>
                    <p className="text-sm font-semibold leading-snug">{insight.value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="dark:bg-[#080810] bg-gray-50 border dark:border-white/8 border-gray-200 rounded-xl p-4">
                <p className="text-sm dark:text-gray-400 text-gray-500">No report highlights yet.</p>
              </div>
            )}
            <div className="dark:bg-[#080810] bg-gray-50 border dark:border-white/8 border-gray-200 rounded-xl p-4">
              <p className="text-xs dark:text-gray-500 text-gray-400 mb-2">Reading Mode</p>
              <p className="text-sm font-semibold dark:text-white text-gray-900">{simpleLanguage ? "Simplified" : "Clinical"}</p>
              <p className="text-xs dark:text-gray-500 text-gray-400 mt-1">Toggle from the header to change report summaries.</p>
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
