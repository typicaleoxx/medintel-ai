// this file is the patient portal where patients view their reports and chat with the ai assistant
// two column layout: report list on the left, chat interface on the right

"use client"

import { useState, useEffect, useRef } from "react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"
import Navbar from "@/components/Navbar"
import { getReports, chatWithAI } from "@/lib/api"
import type { SavedReport } from "@/lib/types"

// suggestion pills shown in the empty chat state to help patients get started
const suggestions = [
  "What is my diagnosis?",
  "What is my treatment plan?",
  "What symptoms were recorded?",
]

interface Message {
  role: "user" | "assistant"
  text: string
}

// group reports by day and count them for the bar chart
function buildChartData(reports: SavedReport[]) {
  const counts: Record<string, number> = {}
  reports.forEach((r) => {
    const day = new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    counts[day] = (counts[day] || 0) + 1
  })
  return Object.entries(counts)
    .map(([date, count]) => ({ date, count }))
    .slice(-7)
}

export default function PatientPage() {
  const [reports, setReports] = useState<SavedReport[]>([])
  const [reportsError, setReportsError] = useState(false)
  const [selectedReport, setSelectedReport] = useState<SavedReport | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // load reports when the page first mounts
  useEffect(() => {
    getReports()
      .then((data) => setReports(data.reports))
      .catch(() => setReportsError(true))
  }, [])

  // scroll to the newest chat message whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSend = async (text?: string) => {
    const question = (text ?? input).trim()
    if (!question || sending) return
    setInput("")
    setMessages((prev) => [...prev, { role: "user", text: question }])
    setSending(true)
    try {
      const data = await chatWithAI(question)
      setMessages((prev) => [...prev, { role: "assistant", text: data.answer }])
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

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

  return (
    <div className="min-h-screen dark:bg-[#080810] bg-gray-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8 flex flex-col gap-6">

        {/* page header */}
        <div>
          <h1 className="text-2xl font-bold dark:text-white text-gray-900">Patient Portal</h1>
          <p className="text-sm dark:text-gray-400 text-gray-500 mt-0.5">
            Review your medical reports and ask the AI assistant questions about your health history.
          </p>
        </div>

        {/* stat cards row showing visit summary */}
        {reports.length > 0 && (() => {
          const lastDate = new Date(reports[0].created_at)
          const daysSince = Math.floor((Date.now() - lastDate.getTime()) / 86400000)
          const chartData = buildChartData(reports)
          return (
            <div className="grid grid-cols-3 gap-4">
              {/* total visits card */}
              <div className="dark:bg-[#0e0e1a] bg-white border dark:border-white/8 border-gray-200 rounded-xl px-5 py-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl dark:bg-blue-500/15 bg-blue-50 flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 text-blue-400 fill-none stroke-current stroke-2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" strokeLinejoin="round" />
                    <circle cx="9" cy="7" r="4" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs dark:text-gray-500 text-gray-400">Total Visits</p>
                  <p className="text-2xl font-bold dark:text-white text-gray-900">{reports.length}</p>
                </div>
              </div>

              {/* last visit card */}
              <div className="dark:bg-[#0e0e1a] bg-white border dark:border-white/8 border-gray-200 rounded-xl px-5 py-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl dark:bg-teal-500/15 bg-teal-50 flex items-center justify-center shrink-0">
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
                  <p className="text-xs dark:text-gray-600 text-gray-400">
                    {daysSince === 0 ? "today" : `${daysSince}d ago`}
                  </p>
                </div>
              </div>

              {/* visit frequency mini chart card */}
              <div className="dark:bg-[#0e0e1a] bg-white border dark:border-white/8 border-gray-200 rounded-xl px-5 py-4">
                <p className="text-xs dark:text-gray-500 text-gray-400 mb-2">Visit Activity</p>
                <ResponsiveContainer width="100%" height={48}>
                  <BarChart data={chartData} barSize={8}>
                    <XAxis dataKey="date" hide />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{ background: "#0e0e1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "11px" }}
                      labelStyle={{ color: "#9ca3af" }}
                      itemStyle={{ color: "#60a5fa" }}
                    />
                    <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                      {chartData.map((_, i) => (
                        <Cell key={i} fill={i === chartData.length - 1 ? "#3b82f6" : "#1e3a5f"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )
        })()}

        {/* two column layout */}
        <div className="flex gap-5 flex-1 min-h-0 chat-panel-height">

          {/* left column: medical reports list */}
          <div className="w-[38%] flex flex-col dark:bg-[#0e0e1a] bg-white border dark:border-white/8 border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b dark:border-white/8 border-gray-200 shrink-0">
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="w-4 h-4 dark:text-gray-400 text-gray-500 fill-none stroke-current stroke-2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinejoin="round" />
                  <polyline points="14,2 14,8 20,8" strokeLinejoin="round" />
                </svg>
                <span className="text-sm font-semibold dark:text-white text-gray-900">Medical Reports</span>
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

              {/* each report shown as a clickable card */}
              {reports.map((r) => (
                <button
                  type="button"
                  key={r.id}
                  onClick={() => setSelectedReport(selectedReport?.id === r.id ? null : r)}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${
                    selectedReport?.id === r.id
                      ? "dark:bg-blue-600/15 bg-blue-50 border-blue-500/30"
                      : "dark:bg-[#080810] bg-gray-50 dark:border-white/8 border-gray-200 dark:hover:border-white/20 hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold dark:text-white text-gray-900">
                      Visit — {formatDate(r.created_at)}
                    </span>
                    <span className="text-xs dark:text-gray-500 text-gray-400">#{r.id}</span>
                  </div>
                  <p className="text-xs dark:text-gray-400 text-gray-500 line-clamp-2 leading-relaxed">
                    {r.subjective}
                  </p>

                  {/* expanded report detail shown when selected */}
                  {selectedReport?.id === r.id && (
                    <div className="mt-3 pt-3 border-t dark:border-white/10 border-gray-200 flex flex-col gap-2">
                      {(["objective", "assessment", "plan"] as const).map((k) => (
                        <div key={k}>
                          <span className="text-xs font-semibold dark:text-blue-400 text-blue-600 capitalize">{k}</span>
                          <p className="text-xs dark:text-gray-400 text-gray-500 mt-0.5 leading-relaxed">{r[k]}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* right column: ai chat interface */}
          <div className="flex-1 flex flex-col dark:bg-[#0e0e1a] bg-white border dark:border-white/8 border-gray-200 rounded-xl overflow-hidden">

            {/* chat header */}
            <div className="flex items-center justify-between px-5 py-4 border-b dark:border-white/8 border-gray-200 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 text-blue-400 fill-none stroke-current stroke-2">
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

            {/* messages area */}
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
              {messages.length === 0 ? (
                // empty state with suggestion pills to prompt the patient
                <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
                  <div className="w-12 h-12 rounded-full dark:bg-white/8 bg-gray-100 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="w-6 h-6 dark:text-gray-500 text-gray-400 fill-none stroke-current stroke-1.5">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium dark:text-white text-gray-900">Ask about your health records</p>
                    <p className="text-xs dark:text-gray-500 text-gray-400 mt-1">
                      I can only answer based on your stored medical reports.
                    </p>
                  </div>
                  {/* suggestion pill buttons */}
                  <div className="flex flex-wrap justify-center gap-2 mt-1">
                    {suggestions.map((s) => (
                      <button
                        type="button"
                        key={s}
                        onClick={() => handleSend(s)}
                        className="px-3 py-1.5 text-xs dark:bg-white/8 bg-gray-100 dark:hover:bg-white/15 hover:bg-gray-200 dark:text-gray-300 text-gray-600 rounded-full border dark:border-white/10 border-gray-200 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                // conversation messages
                <>
                  {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                          m.role === "user"
                            ? "bg-blue-600 text-white rounded-br-sm"
                            : "dark:bg-[#080810] bg-gray-100 dark:text-gray-300 text-gray-700 rounded-bl-sm dark:border-white/8 border-gray-200 border"
                        }`}
                      >
                        {m.text}
                      </div>
                    </div>
                  ))}
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

            {/* chat input bar */}
            <div className="px-4 py-4 border-t dark:border-white/8 border-gray-200 shrink-0">
              <div className="flex items-end gap-3 dark:bg-[#080810] bg-gray-50 border dark:border-white/10 border-gray-200 rounded-xl px-4 py-3">
                <textarea
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
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
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
        </div>
      </main>

      {/* footer */}
      <footer className="border-t dark:border-white/8 border-gray-200 py-4 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <span className="text-xs dark:text-gray-600 text-gray-400">MedIntel MVP — AI Clinical Documentation Platform</span>
          <span className="text-xs dark:text-gray-600 text-gray-400">Powered by Gemini · Neon · FastAPI · Next.js</span>
        </div>
      </footer>
    </div>
  )
}
