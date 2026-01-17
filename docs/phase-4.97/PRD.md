# Product Requirements Document: Phase 4.97 - System-Wide Rate Limiting

## 1. Title
Phase 4.97 - System-Wide Rate Limiting & Traffic Control

## 2. Introduction
This document outlines the requirements for **Phase 4.97** of the Azan Dashboard project. As the system evolves into a production-ready home automation hub, it is critical to protect both the server resources and the external API quotas. This phase introduces a comprehensive Rate Limiting architecture, covering Inbound traffic (protecting the Node.js server from abuse/spam) and Outbound traffic (protecting the user's IP from being banned by third-party providers like Aladhan and VoiceMonkey).

## 3. Product Overview
The system will implement a "Defense in Depth" strategy. 
1.  **Inbound:** `express-rate-limit` middleware will be applied to API routes. Specific "high-risk" endpoints (Login, Setup) will have strict limits, while general polling endpoints will be more permissive to support multi-screen setups.
2.  **Outbound:** The `bottleneck` library will wrap external service calls. Background automation tasks will be **Queued** (delayed) if limits are hit, ensuring execution eventual consistency. User-initiated actions (UI Buttons) will be **Rejected** at the API level if spammed, providing immediate feedback.
3.  **Frontend:** The React application will be updated to handle HTTP 429 (Too Many Requests) errors gracefully, implementing exponential back-off for polling to prevent log flooding.

## 4. Goals and Objectives
*   **Security:** Prevent brute-force attacks on authentication endpoints.
*   **Stability:** Protect the server from CPU/IO exhaustion caused by spamming resource-heavy endpoints (e.g., TTS Generation).
*   **Compliance:** Respect the rate limits of external APIs (VoiceMonkey, Aladhan) to prevent IP bans.
*   **Observability:** Log rate-limit violations to the SSE console for administrator awareness.

## 5. Target Audience
*   **System Administrators:** Ensuring their server remains responsive and their external integrations (Alexa, Prayer Times) remain functional and unblocked.

## 6. Features and Requirements

### 6.1 Inbound Rate Limiting (Middleware)
*   **FR-01: Infrastructure Support**
    *   The system MUST support `trust proxy` configuration to correctly identify client IPs when running behind Nginx/Reverse Proxies.
*   **FR-02: Security Tier (Strict)**
    *   **Scope:** `/api/auth/login`, `/api/auth/setup`, `/api/auth/change-password`.
    *   **Limit:** 5 requests per 15 minutes per IP.
    *   **Action:** Reject with 429. Log security alert to SSE.
*   **FR-03: Operations Tier (Medium)**
    *   **Scope:** `/api/system/regenerate-tts`, `/api/settings/refresh-cache`, `/api/settings/upload`, `/api/system/restart-scheduler`, `/api/system/test-audio`, `/api/system/validate-url`.
    *   **Limit:** 5 requests per minute per IP.
    *   **Action:** Reject with 429.
*   **FR-04: Global Read Tier (Generous)**
    *   **Scope:** All other `GET` requests (excluding SSE).
    *   **Limit:** 300 requests per 15 minutes (approx 1 req/3s) to accommodate multiple dashboard clients polling simultaneously.
*   **FR-05: Global Write Tier (General)**
    *   **Scope:** All other `POST`, `PUT`, `DELETE` requests.
    *   **Limit:** 50 requests per 15 minutes.
*   **FR-06: SSE Exception**
    *   The `/api/logs` endpoint MUST be excluded from standard rate limits but SHOULD have a "Connection Rate" limit (e.g., max 10 new connections per minute) to prevent reconnect loops.

### 6.2 Outbound Rate Limiting (Service Wrappers)
*   **FR-07: Queue Architecture**
    *   Implement `src/utils/requestQueue.js` exporting singleton `bottleneck` instances.
*   **FR-08: Provider Limits**
    *   **Aladhan:** 1 request per 2 seconds (Queueing).
    *   **MyMasjid:** 1 request per minute (Queueing).
    *   **VoiceMonkey:** 1 request per second, with a burst allowance of 5 (Queueing).
*   **FR-09: Service Integration**
    *   Refactor `fetchers.js` to use the Aladhan/MyMasjid queues.
    *   Refactor `automationService.js` to use the VoiceMonkey queue.

### 6.3 Frontend Handling
*   **FR-10: Error Handling**
    *   The `SettingsContext` save handler MUST catch 429 errors and return a user-friendly message ("Too many requests. Please wait X seconds.").
    *   Global `fetch` interceptors or specific handlers in `DeveloperSettingsView` MUST detect 429 on polling endpoints.
*   **FR-11: Back-off Strategy**
    *   If polling (Jobs/Status) receives a 429, the frontend MUST pause polling for a minimum of 60 seconds before retrying.

## 7. User Stories and Acceptance Criteria

### US-1: Brute Force Protection
**As a** system owner,
**I want** the system to block login attempts after 5 failed tries,
**So that** an attacker cannot guess my password.

*   **AC-1:** Attempt login 5 times rapidly.
*   **AC-2:** 6th attempt returns HTTP 429.
*   **AC-3:** SSE Logs show "Rate Limit Exceeded for /api/auth/login".

### US-2: API Safety
**As a** developer,
**I want** my automation to queue requests to VoiceMonkey,
**So that** triggering 5 prayers simultaneously doesn't get my API token banned.

*   **AC-1:** Configure 10 triggers to fire at exactly the same time.
*   **AC-2:** System logs show requests executing sequentially (or with 1s gaps) rather than all at once.

### US-3: UI Feedback
**As a** user,
**I want** to be told if I am clicking the "Regenerate TTS" button too fast,
**So that** I don't crash the server.

*   **AC-1:** Click "Regenerate TTS" 6 times in under a minute.
*   **AC-2:** The 6th click results in a red Toast notification: "Too many requests, please try again later."

## 8. Technical Requirements / Stack

*   **Backend:**
    *   `express-rate-limit`: For Inbound middleware.
    *   `bottleneck`: For Outbound queueing.
*   **Frontend:**
    *   Update `SettingsContext` and `useSSE` (Log display).

## 9. Implementation Details

### 9.1 Middleware Configuration (`rateLimiters.js`)
```javascript
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        // Log to SSE
        sseService.log(`Rate limit exceeded for ${req.ip} on ${req.path}`, 'WARN');
        res.status(429).json({ error: 'Too many requests' });
    }
});
```

## 10. Open Questions / Assumptions
*   **Assumption:** The server environment is single-process (no clustering). `express-rate-limit` stores counters in memory. If clustered, a Redis store would be needed (out of scope).