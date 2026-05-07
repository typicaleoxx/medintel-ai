// this file provides the application shell: left navigation plus top status header

"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { getDemoSession, resetDemoSession } from "@/lib/demoSession"
import ThemeToggle from "./ThemeToggle"

export default function Navbar() {
  const pathname = usePathname()
  const [demoActive, setDemoActive] = useState(false)

  useEffect(() => {
    setDemoActive(Boolean(getDemoSession()))
  }, [pathname])

  const tabs = [
    { label: "Doctor Portal", href: "/doctor", desc: "clinical workspace" },
    { label: "Patient Portal", href: "/patient", desc: "health record view" },
  ]
  const mode = pathname.startsWith("/patient") ? "Patient Portal" : pathname.startsWith("/doctor") ? "Doctor Portal" : "Entry"

  const exitDemo = () => {
    resetDemoSession()
    setDemoActive(false)
    window.location.reload()
  }

  return (
    <>
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-50 w-64 dark:bg-[#080810] bg-white border-r dark:border-white/10 border-gray-200 flex-col">
        <div className="h-16 px-5 flex items-center border-b dark:border-white/10 border-gray-200">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-white fill-none stroke-current stroke-2">
                <polyline points="2,12 6,6 10,16 14,8 18,14 22,12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="font-semibold text-sm">
              <span className="dark:text-white text-gray-900">Med</span>
              <span className="text-violet-500">Intel</span>
            </span>
          </Link>
        </div>

        <nav className="p-4 flex flex-col gap-2">
          {tabs.map((tab) => {
            const isActive = pathname.startsWith(tab.href)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-4 py-3 rounded-xl text-sm transition-all border ${
                  isActive
                    ? "bg-violet-600 text-white border-violet-500 shadow-sm"
                    : "dark:text-gray-400 text-gray-600 dark:border-white/8 border-gray-200 dark:hover:text-white hover:text-gray-900 dark:hover:bg-white/5 hover:bg-gray-50"
                }`}
              >
                <span className="font-semibold block">{tab.label}</span>
                <span className={`text-xs ${isActive ? "text-violet-100" : "dark:text-gray-600 text-gray-400"}`}>{tab.desc}</span>
              </Link>
            )
          })}
        </nav>

        <div className="mt-auto p-4">
          <div className="rounded-xl dark:bg-white/5 bg-gray-50 border dark:border-white/8 border-gray-200 p-4">
            <p className="text-xs font-semibold dark:text-white text-gray-900 mb-1">{demoActive ? "Demo session" : "Real app mode"}</p>
            <p className="text-xs dark:text-gray-500 text-gray-500 leading-relaxed">
              {demoActive ? "Temporary, isolated, and seeded with realistic sample data." : "Using the database-backed app with persistent reports."}
            </p>
            {demoActive && (
              <button
                type="button"
                onClick={exitDemo}
                className="mt-3 text-xs font-semibold text-violet-500 hover:text-violet-400"
              >
                Exit demo mode
              </button>
            )}
          </div>
        </div>
      </aside>

      <header className="fixed top-0 left-0 lg:left-64 right-0 h-16 border-b dark:border-white/10 border-gray-200 dark:bg-[#080810]/95 bg-white/95 backdrop-blur z-40">
        <div className="h-full px-5 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="lg:hidden flex items-center gap-2.5 shrink-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-4 h-4 text-white fill-none stroke-current stroke-2">
                  <polyline points="2,12 6,6 10,16 14,8 18,14 22,12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </Link>
            <div>
              <p className="text-xs dark:text-gray-500 text-gray-400">Current Mode</p>
              <h1 className="text-sm font-semibold dark:text-white text-gray-900">
                {mode}{demoActive ? " · Demo" : " · Real App"}
              </h1>
            </div>
          </div>
          {demoActive && (
            <button
              type="button"
              onClick={exitDemo}
              className="hidden sm:inline-flex text-xs px-3 py-1.5 rounded-full dark:bg-white/8 bg-gray-100 dark:text-gray-300 text-gray-600 border dark:border-white/10 border-gray-200 hover:border-violet-500/30 transition-colors"
            >
              Exit demo
            </button>
          )}
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs dark:text-gray-400 text-gray-500">AI ready</span>
          </div>
          <ThemeToggle />
        </div>
      </header>
    </>
  )
}
