// this component is the dark and light mode toggle button in the navbar
// it reads from localStorage on mount so the preference persists across sessions

"use client"

import { useState, useEffect } from "react"

export default function ThemeToggle() {
  const [dark, setDark] = useState(true)

  // read the saved preference once the component mounts on the client
  useEffect(() => {
    const saved = localStorage.getItem("theme") || "dark"
    setDark(saved === "dark")
  }, [])

  const toggle = () => {
    const next = !dark
    setDark(next)
    localStorage.setItem("theme", next ? "dark" : "light")
    document.documentElement.classList.toggle("dark", next)
  }

  return (
    <button
      onClick={toggle}
      className="w-8 h-8 flex items-center justify-center rounded-full dark:bg-white/10 bg-black/10 dark:hover:bg-white/20 hover:bg-black/20 transition-colors text-sm"
      aria-label="toggle theme"
    >
      {dark ? "☀️" : "🌙"}
    </button>
  )
}
