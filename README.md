# MedIntel

AI-powered clinical documentation and patient interaction platform.

Doctors input symptoms, observations, and diagnosis — the system generates a structured SOAP report using Gemini AI. Patients can view their report history and ask questions answered from their own medical data.

**Stack:** Next.js · FastAPI · Gemini API · Neon Postgres  
**Deployment:** Vercel (frontend) · Render (backend)  
**Cost:** $0 (all free tiers)

---

## Project Structure

```
medintel-ai/
├── frontend/   Next.js app (doctor and patient pages)
└── backend/    FastAPI server (AI, database, API routes)
```

---

## Getting Started

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in your keys
uvicorn main:app --reload
```

API docs available at `http://localhost:8000/docs`

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local   # fill in backend URL
npm run dev
```

App available at `http://localhost:3000`

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string |
| `GEMINI_API_KEY` | Gemini API key from aistudio.google.com |
| `ALLOWED_ORIGINS` | Comma separated list of allowed frontend URLs |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | URL of the FastAPI backend |

---

## Problems We Hit (and How We Fixed Them)

Real issues encountered during development, documented for reference.

---

**Node.js version conflict**

Next.js 16 requires Node >= 20 but the system had Node 18. The scaffold installed but the build failed silently.

Fix: downgraded to Next.js 15 which officially supports Node 18, and switched from Tailwind v4 to Tailwind v3 since the v4 PostCSS plugin also requires Node 20.

---

**Tailwind v4 config in a v3 project**

The Next.js scaffold generated a Tailwind v4 style config (`@import "tailwindcss"` in globals.css, `@tailwindcss/postcss` in postcss.config). After downgrading to Tailwind v3 these caused build errors.

Fix: replaced globals.css with standard v3 directives, rewrote postcss.config to use `tailwindcss` and `autoprefixer`, added a proper `tailwind.config.ts`.

---

**Uvicorn running against the wrong Python**

Running `uvicorn main:app` without activating the venv used the system Anaconda Python, which didn't have `google.generativeai` installed.

Fix: activate the project venv first with `source .venv/bin/activate`, then run uvicorn.

---

**Gemini API key with zero quota**

API key created from Google Cloud Console showed `limit: 0` on all free tier metrics. Every request returned a 429 even though the key was valid.

Fix: keys for the Gemini free tier must come from **Google AI Studio** (aistudio.google.com/app/apikey), not Google Cloud Console.

---

**Old Gemini SDK incompatible with new API keys**

The `google-generativeai` SDK (v0.8.x) talks to the deprecated v1beta API endpoint. Newer AI Studio keys only support the v1 endpoint, causing 404 errors on every generate request.

Fix: migrated to the new `google-genai` SDK which targets v1 by default. Import changes from `import google.generativeai as genai` to `from google import genai`.

---

**New SDK not installed after switching packages**

After changing `requirements.txt` from `google-generativeai` to `google-genai`, uvicorn crashed with `ImportError: cannot import name 'genai' from 'google'` because the venv still had the old package and not the new one.

Fix: whenever `requirements.txt` changes, always run `pip install -r requirements.txt` inside the venv before restarting the server.

---

**gemini-1.5-flash model removed from API**

After switching to the new `google-genai` SDK, requests using `gemini-1.5-flash` returned a 404 saying the model is not found. The model was removed from the API entirely by the time of development.

Fix: listed available models with `client.models.list()` and switched to `gemini-2.0-flash` which is available on the free tier.
