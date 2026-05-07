// recruiter-friendly demo entry screen with instant role selection

"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { resetDemoSession, startDemoSession, type DemoRole } from "@/lib/demoSession"

const options: { role: DemoRole; title: string; copy: string; href: string }[] = [
  {
    role: "doctor",
    title: "Doctor Demo",
    copy: "Generate a SOAP report from clinical notes and save it into this temporary demo session.",
    href: "/doctor",
  },
  {
    role: "patient",
    title: "Patient Demo",
    copy: "Open a preloaded patient history and ask grounded questions about the reports.",
    href: "/patient",
  },
]

export default function Home() {
  const router = useRouter()
  const [loadingRole, setLoadingRole] = useState<DemoRole | null>(null)
  const [error, setError] = useState("")

  const enterDemo = async (role: DemoRole, href: string) => {
    setLoadingRole(role)
    setError("")
    try {
      await startDemoSession(role)
      router.push(href)
    } catch {
      setError("Could not start demo mode. Make sure the backend is running.")
      setLoadingRole(null)
    }
  }

  const enterRealApp = () => {
    resetDemoSession()
    router.push("/doctor")
  }

  return (
    <main className="min-h-screen dark:bg-[#080810] bg-gray-50 flex items-center justify-center px-6">
      <div className="max-w-4xl w-full">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-white fill-none stroke-current stroke-2">
                <polyline points="2,12 6,6 10,16 14,8 18,14 22,12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="font-semibold text-lg">
              <span className="dark:text-white text-gray-900">Med</span>
              <span className="text-violet-500">Intel</span>
            </span>
          </div>
          <h1 className="text-3xl font-bold dark:text-white text-gray-900">MedIntel</h1>
          <p className="text-sm dark:text-gray-400 text-gray-500 mt-2 max-w-2xl">
            Open the real app with your database-backed reports, or start an isolated recruiter demo with preloaded sample data.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          <button
            type="button"
            onClick={enterRealApp}
            disabled={Boolean(loadingRole)}
            className="text-left dark:bg-[#0e0e1a] bg-white border dark:border-white/8 border-gray-200 rounded-xl p-6 hover:border-emerald-500/40 disabled:opacity-60 transition-all card-glow"
          >
            <div className="flex items-center justify-between mb-5">
              <div className="w-11 h-11 rounded-xl dark:bg-emerald-500/15 bg-emerald-50 border dark:border-emerald-500/20 border-emerald-200 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-emerald-500 fill-none stroke-current stroke-2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinejoin="round" />
                  <polyline points="14,2 14,8 20,8" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="text-xs dark:text-gray-500 text-gray-400">database mode</span>
            </div>
            <h2 className="text-xl font-bold dark:text-white text-gray-900">Real App</h2>
            <p className="text-sm dark:text-gray-400 text-gray-500 mt-2 leading-relaxed">
              Use the original Postgres-backed doctor and patient workflow without demo session isolation.
            </p>
          </button>

          {options.map((option) => (
            <button
              key={option.role}
              type="button"
              onClick={() => enterDemo(option.role, option.href)}
              disabled={Boolean(loadingRole)}
              className="text-left dark:bg-[#0e0e1a] bg-white border dark:border-white/8 border-gray-200 rounded-xl p-6 hover:border-violet-500/40 disabled:opacity-60 transition-all card-glow"
            >
              <div className="flex items-center justify-between mb-5">
                <div className="w-11 h-11 rounded-xl dark:bg-violet-500/15 bg-violet-50 border dark:border-violet-500/20 border-violet-200 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 text-violet-500 fill-none stroke-current stroke-2">
                    {option.role === "doctor" ? (
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z" strokeLinejoin="round" />
                    ) : (
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinejoin="round" />
                    )}
                  </svg>
                </div>
                <span className="text-xs dark:text-gray-500 text-gray-400">
                  {loadingRole === option.role ? "starting..." : "instant access"}
                </span>
              </div>
              <h2 className="text-xl font-bold dark:text-white text-gray-900">{option.title}</h2>
              <p className="text-sm dark:text-gray-400 text-gray-500 mt-2 leading-relaxed">{option.copy}</p>
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-5 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}
      </div>
    </main>
  )
}
