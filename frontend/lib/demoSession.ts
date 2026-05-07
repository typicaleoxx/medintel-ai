export type DemoRole = "doctor" | "patient"

const SESSION_KEY = "medintel_demo_session"
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

interface DemoSession {
  sessionId: string
  role: DemoRole
  createdAt: number
}

function newSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `demo-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function getDemoSession(): DemoSession | null {
  if (typeof window === "undefined") return null
  const raw = sessionStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as DemoSession
  } catch {
    sessionStorage.removeItem(SESSION_KEY)
    return null
  }
}

export function getDemoHeaders(): Record<string, string> {
  const session = getDemoSession()
  return session ? { "x-demo-session-id": session.sessionId } : {}
}

export async function startDemoSession(role: DemoRole) {
  const session: DemoSession = {
    sessionId: newSessionId(),
    role,
    createdAt: Date.now(),
  }

  const res = await fetch(`${API_URL}/api/demo/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: session.sessionId, role }),
  })
  if (!res.ok) throw new Error("failed to start demo session")

  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
  return session
}

export function resetDemoSession() {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(SESSION_KEY)
  }
}
