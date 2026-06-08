# AutoClaim AI

> **UiPath AgentHack 2026 — Track 1: UiPath Maestro Case**

AutoClaim AI is an end-to-end insurance claims automation platform that combines **Claude AI agents**, **UiPath Maestro Case orchestration**, and a **human-in-the-loop review interface** to take a claim from raw email or PDF intake all the way to resolution — automatically when possible, with targeted human oversight when needed.

---

## Demo

🎥 **[Watch the full demo on YouTube](#)** ← *(replace with your link before submission)*

![Dashboard](docs/screenshot-dashboard.png)

---

## Architecture

```
[Email/PDF/Form] → [Intake Agent] → [UiPath Maestro Case]
                                             |
                                  [Extraction Agent (Claude)]
                                             |
                                   [Validation Robot]
                                             |
                          ┌──────────────────┴──────────────────┐
                          ↓                                      ↓
                    [Auto-Approve]                    [Human Review Queue]
                          ↓                                      ↓
                     [RESOLVED]                      [Reviewer Decision]
                                                               ↓
                                                          [RESOLVED]
```

### Routing Logic

```
riskScore < 40  AND  isValid  ──────────────────►  APPROVED  (auto)
riskScore 40-69  AND  isValid  ─────────────────►  PENDING_REVIEW
isValid = false  AND  errors  ──────────────────►  EXCEPTION_ROUTING
riskScore ≥ 70   OR  amount > $50K  ────────────►  ESCALATED
```

### Claim Lifecycle

```
SUBMITTED → EXTRACTING → VALIDATING → PENDING_REVIEW → APPROVED
                                    ↘ EXCEPTION_ROUTING ↗
                                    ↘ ESCALATED ────────►  REJECTED
```

---

## UiPath Components Used

| Component | Role | Code |
|---|---|---|
| **UiPath Maestro Case** | Central orchestration — sequences stages, manages state transitions, queues exceptions | `lib/orchestrator.ts` — `ClaimOrchestrator` |
| **UiPath Agent Builder** | AI extraction agent — reads raw claim text, produces structured data via Claude Sonnet | `lib/agents.ts` — `extractClaimData()` |
| **UiPath Automation Cloud** | Deployment target — Next.js app hosted on any Node.js runtime compatible with Automation Cloud | Entire `autoclaim-ai/` app |
| **UiPath Orchestrator** | Workflow control & scheduling — `processPendingClaims()` cron hook | `GET /api/orchestrate` |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router, Server Components) |
| AI Model | Claude Sonnet `claude-sonnet-4-20250514` via `@anthropic-ai/sdk` |
| Database | SQLite via `better-sqlite3` (WAL mode, no external server) |
| Schema Validation | Zod 4 |
| Styling | Tailwind CSS 3 — dark theme, glassmorphism cards |
| Language | TypeScript 5 (strict + `exactOptionalPropertyTypes`) |
| File Ingestion | `pdf-parse` for PDF, plain text for email mock |
| Runtime | Node.js 20+ |

---

## Setup

### Prerequisites

- Node.js 20+
- An [Anthropic API key](https://console.anthropic.com)

### 1 — Clone & install

```bash
git clone https://github.com/your-username/AutoClaim-AI.git
cd AutoClaim-AI/autoclaim-ai
npm install
```

### 2 — Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
ANTHROPIC_API_KEY=your_key_here
DATABASE_PATH=./autoclaim.db
NEXT_PUBLIC_APP_NAME=AutoClaim AI
NEXT_PUBLIC_HACKATHON=UiPath AgentHack 2026
```

### 3 — Seed demo data (optional)

```bash
npm run seed
```

### 4 — Start development server

```bash
npm run dev
# → http://localhost:3000
```

| URL | Page |
|---|---|
| `http://localhost:3000` | Dashboard |
| `http://localhost:3000/claims` | All claims |
| `http://localhost:3000/review` | Human review queue |
| `http://localhost:3000/claims/new` | Submit new claim |

---

## How to Run the Demo

The demo script simulates the complete workflow **without an Anthropic API key** (deterministic mock agents):

```bash
npm run demo
```

### What it does (~20 seconds)

```
Step 0  Reset DB, create reviewers (Alice, Bob, Fatima)

Step 1  Simple PROPERTY_DAMAGE claim — $850
        → confidence 94%, risk 0/100
        ✅ Auto-approved by Maestro

Step 2  High-value MEDICAL claim — $45,000
        → confidence 68%, risk 55/100
        ⚠️ Routed to human review (Alice Martin)

Step 3  THEFT claim — missing police report & inventory list
        → documentsComplete=false, risk 20/100
        ❌ Exception route triggered → PENDING_REVIEW

Step 4  Human decision: Alice approves Claim 2
        ✅ Human reviewer approved claim

Step 5  Final stats table
        ┌────────────────────────────────────────┐
        │  Auto-resolved by AI       :  1        │
        │  Approved by human review  :  1        │
        │  Pending review (open)     :  1        │
        │  Auto-approval rate        :  33%      │
        └────────────────────────────────────────┘
```

After the demo runs, start `npm run dev` to explore the full UI with the populated data.

---

## Project Structure

```
autoclaim-ai/
├── app/
│   ├── api/
│   │   ├── claims/           CRUD — list, get, patch, delete
│   │   ├── extract/          Trigger Claude extraction
│   │   ├── validate/         Trigger validation robot
│   │   ├── orchestrate/      POST → processNewClaim, GET → poll stalled
│   │   ├── review/           Queue, decision, reassign, stats
│   │   └── reviewers/        Reviewer management + availability
│   ├── claims/               List page, detail page, new claim form
│   ├── review/               Queue UI + reviewer personal page
│   └── page.tsx              Dashboard
├── components/
│   ├── ui/
│   │   ├── DropZone.tsx      File upload with drag & drop
│   │   ├── LiveCounter.tsx   Animated KPI counter
│   │   └── Toast.tsx         Notification toasts
│   ├── ClaimCard.tsx         Mobile-first claim summary card
│   ├── ClaimTimeline.tsx     Orchestration audit trail
│   ├── ReviewPanel.tsx       Human decision panel
│   ├── PriorityBadge.tsx
│   ├── StatusBadge.tsx
│   └── Sidebar.tsx           Navigation sidebar
├── lib/
│   ├── agents.ts             Claude extraction + rule-based validation
│   ├── orchestrator.ts       Maestro Case local simulation
│   ├── db.ts                 SQLite layer (better-sqlite3, WAL)
│   ├── types.ts              Domain types
│   └── validation.ts         Zod schemas
└── data/
    ├── seed.ts               Seed 6 demo claims + 3 reviewers
    ├── demo.ts               Full workflow demo (npm run demo)
    └── sample-claims/        Test .txt email files
```

---

## License

MIT © 2026 — Built for **UiPath AgentHack 2026**
