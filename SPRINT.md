## Sprint 0 Setup and environment

### Objective

Prepare development environment and core infrastructure

### Identify

Frontend application
Backend service
Database
AI API access

### Setup

Initialize Next.js frontend
Initialize FastAPI backend
Create database on Neon
Obtain Gemini API key
Configure environment variables on local system

### Execute

Run frontend locally
Run backend locally
Test database connection
Verify API key works

### Output

Working development environment ready for feature development

---

## Sprint 1 Backend and AI

### Objective

Enable AI report generation capability

### Identify

Core functionality is transforming doctor input into structured report

### Setup

Define API endpoint for report generation
Define structured SOAP prompt

### Execute

Receive doctor input
Send input to AI model
Receive structured SOAP report
Return response to client

### Checks

Output always contains Subjective Objective Assessment Plan
Response is consistent and structured

### Output

Working report generation API

---

## Sprint 2 Storage and retrieval

### Objective

Persist reports and enable retrieval

### Identify

Need reliable storage and access to recent reports

### Setup

Create reports table in database

### Execute

Store generated reports in database
Retrieve latest three reports

### Checks

Data stored correctly
Latest reports returned in correct order
No duplication or missing records

### Output

Working storage and retrieval system

---

## Sprint 3 Doctor interface

### Objective

Enable doctor interaction with system

### Identify

Doctor needs to input data and generate report

### Setup

Create doctor page in frontend
Add input fields for symptoms observations diagnosis
Add voice input using browser speech recognition

### Execute

Submit form to backend
Display generated report
Save report to database

### Checks

Form submission works
Report renders correctly
Voice input fills fields properly

### Output

Fully functional doctor interface

---

## Sprint 4 Patient interface and chat

### Objective

Enable patient to view reports and interact with AI

### Identify

Patient needs report access and chat capability

### Setup

Create patient page
Display list of reports
Add chat interface

### Execute

Fetch reports from backend
Display reports clearly
Send chat query to backend
Display AI response

### Checks

Reports load consistently
Chat responses use stored data
System returns uncertainty when data is missing

### Output

Working patient interface and chat system

---

## Sprint 5 Deployment

### Objective

Make system publicly accessible

### Identify

Need hosting for frontend and backend

### Setup

Deploy frontend to Vercel
Deploy backend to Render
Configure environment variables in both platforms

### Execute

Connect frontend to backend API
Test all endpoints in deployed environment

### Checks

No connection errors
API calls succeed
Environment variables load correctly

### Output

Live deployed application

---

## Sprint 6 Testing and stabilization

### Objective

Ensure system reliability and readiness

### Identify

Focus on failures in input handling API responses and UI

### Setup

Define test scenarios

### Execute

Test report generation
Test report saving
Test report retrieval
Test chat responses
Test empty inputs
Test large inputs
Test unrelated queries

### Checks

System handles errors gracefully
No crashes in UI
Responses remain consistent

### Output

Stable and demo ready system

---

## Sprint 7 Security

### Objective

Ensure system operates safely within MVP constraints

### Identify

Risks include input misuse API abuse AI hallucination and data exposure

### Setup

Define validation rules request limits and secure configurations

### Execute

Enforce input length limits and reject invalid input
Apply request limiting to prevent excessive usage
Store API keys securely using environment variables on Render and Vercel
Constrain AI to respond only from provided context and return uncertainty when needed
Store only non sensitive report data without identifiers
Ensure frontend never exposes backend secrets and safely renders content
Restrict database access to backend only

### Checks

Invalid inputs are blocked
Excessive requests are limited
No secrets exposed in repository or client side
AI responses stay within allowed context
Database contains only safe data
No direct external access to backend or database

### Output

System operates with controlled input secure API usage safe AI behavior and protected data flow
