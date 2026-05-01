// this file is the shared top navigation bar shown on every page
// it has the logo on the left, centered page tabs, and status plus theme toggle on the right

"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import ThemeToggle from "./ThemeToggle"

export default function Navbar() {
  const pathname = usePathname()

  const tabs = [
    { label: "Doctor Portal", href: "/doctor" },
    { label: "Patient Portal", href: "/patient" },
  ]

  return (
    <header className="border-b dark:border-white/10 border-black/10 dark:bg-[#080810] bg-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-4">

        {/* logo with waveform icon and product name */}
        <Link href="/doctor" className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-white fill-none stroke-current stroke-2">
              <polyline points="2,12 6,6 10,16 14,8 18,14 22,12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="font-semibold text-sm">
            <span className="dark:text-white text-gray-900">Med</span>
            <span className="text-blue-500">Intel</span>
          </span>
        </Link>

        {/* centered pill tab switcher between doctor and patient views */}
        <div className="flex items-center gap-1 dark:bg-white/10 bg-black/10 rounded-full p-1">
          {tabs.map((tab) => {
            const isActive = pathname.startsWith(tab.href)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-5 py-1.5 rounded-full text-sm font-medium transition-all ${
                  isActive
                    ? "bg-blue-600 text-white shadow-sm"
                    : "dark:text-gray-400 text-gray-500 dark:hover:text-white hover:text-gray-900"
                }`}
              >
                {tab.label}
              </Link>
            )
          })}
        </div>

        {/* ai status indicator and theme toggle */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs dark:text-gray-400 text-gray-500">AI Online</span>
          </div>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
