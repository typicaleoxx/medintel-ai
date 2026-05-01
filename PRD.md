## 1. Foundation

**Product Name:** MedIntel MVP
**Type:** AI-powered clinical documentation and patient interaction platform
**Objective:** Build and deploy a **complete, stable, zero-cost, end-to-end system** that demonstrates strong full-stack engineering and practical AI integration

---

## 2. Purpose

### Core Problem

- Doctors spend excessive time on manual documentation
- Clinical notes are inconsistent and unstructured
- Patients cannot easily understand or interact with their medical reports
- No personalized, context-aware follow-up exists

---

### Solution

MedIntel provides:

- AI-generated structured clinical reports from doctor input
- Persistent storage of visit data
- A patient-facing AI assistant grounded in their own history

---

## 3. Product Scope

### Included

- Doctor input (text + optional voice)
- AI-generated SOAP report
- Persistent report storage
- Patient report viewing
- Context-based AI chat (RAG-lite)
- Public deployment

---

### Excluded

- Authentication and user accounts
- Multi-patient or multi-doctor systems
- Vector databases or embeddings
- Real-time streaming or audio storage
- Predictive analytics or risk modeling
- Any paid infrastructure

---

## 4. System Architecture

```text id="q5vjwr"
Frontend (Next.js) deployed on Vercel
        |
        v
Backend API (FastAPI) deployed on Render
        |
        v
AI Model (Gemini API)
        |
        v
Database (Neon Postgres)
```

---

## 5. User Flows

---

### 5.1 Doctor Workflow

1. Access Doctor Page
2. Input:
   - symptoms
   - observations
   - diagnosis
     (voice input converts speech to text if used)

3. Trigger report generation
4. System returns structured SOAP report
5. Review and save report

---

### 5.2 Patient Workflow

1. Access Patient Page
2. View list of stored reports
3. Review report details
4. Enter question in chat
5. System retrieves recent reports
6. AI responds using only retrieved data

---

## 6. Functional Requirements

---

### 6.1 Doctor Interface

- Three structured input fields
- Voice-to-text input (browser-based)
- Action to generate report
- Display structured report output
- Action to save report

---

### 6.2 AI Report Generation

- Input: structured clinical fields
- Output: SOAP format
  - Subjective
  - Objective
  - Assessment
  - Plan

- Output must be consistent and clearly structured

---

### 6.3 Data Storage

- Store each report as a record
- Include timestamp
- Support retrieval of recent reports

---

### 6.4 Patient Interface

- Display list of reports
- Show report content
- Provide chat interface

---

### 6.5 Patient AI Chat

- Retrieve last 3 reports
- Use them as context
- Restrict responses to provided data
- Return uncertainty if answer not present

---

## 7. Technical Requirements

---

### 7.1 Frontend

- Framework: Next.js
- Pages:
  - Doctor Page
  - Patient Page

- Responsibilities:
  - Form handling
  - API communication
  - Chat interface
  - Voice input via browser speech recognition

---

### 7.2 Backend

- Framework: FastAPI
- Responsibilities:
  - API endpoints for report generation, storage, retrieval, and chat
  - AI request handling
  - Prompt construction
  - Data persistence

---

### 7.3 Database

- Platform: Neon
- Structure:
  - Single table storing report content and timestamps

---

### 7.4 AI Integration

- Model: Gemini API

- Functions:
  - Generate structured SOAP reports
  - Answer patient queries

- Constraints:
  - Enforce structured output
  - Enforce context-based answering

---

### 7.5 Deployment

- Frontend: Vercel
- Backend: Render
- Database: Neon

---

## 8. Non-Functional Requirements

---

### Performance

- Report generation within a few seconds
- Chat responses within acceptable latency

---

### Reliability

- Graceful handling of backend or AI failures
- Stable request-response behavior

---

### Security (MVP Level)

- No real patient data
- API keys stored securely in environment variables
- No exposure of sensitive information

---

### Cost Constraint

- Must remain within free tiers
- No services that can trigger billing

---

## 10. Stability Design Decisions

- Single-table data model to reduce complexity
- Stateless backend for reliability
- RAG-lite approach to avoid instability
- No authentication to prevent blocking issues
- Minimal dependencies to reduce failure points

---

## 11. Risks and Mitigation

| Risk                    | Mitigation                 |
| ----------------------- | -------------------------- |
| AI output inconsistency | enforce structured prompts |
| API quota limits        | limit request frequency    |
| Backend cold start      | acceptable for demo        |
| Data inconsistency      | simplified schema          |

---

## 12. Success Criteria

- Doctor can generate a report successfully
- Reports are stored and retrievable
- Patient can view reports
- Patient can ask questions and receive context-based answers
- Application is publicly accessible via deployed URL

---

## 13. Summary Table

| Area        | Implementation        |
| ----------- | --------------------- |
| Input       | Text + voice          |
| Processing  | AI SOAP generation    |
| Storage     | Postgres              |
| Retrieval   | Last 3 reports        |
| Interaction | Context-based AI chat |
| Deployment  | Vercel + Render       |
| Cost        | $0                    |

## Deliverable

A deployed web application where:

- doctor input → AI-generated structured report → stored
- patient → interacts with their own medical history through AI
