# The Negotiator — Study Abroad Edition

<<<<<<< HEAD
An AI voice agent (ElevenLabs Agents + Twilio) that calls UK study-abroad consultancies
on behalf of a Pakistani student, extracts itemised quotes mid-call, negotiates service
fees down using leverage from competing quotes, and produces a ranked GBP + PKR report
with transcript evidence.

Built for the Hack-Nation 6th Global AI Hackathon — ElevenLabs track.

## Modules
1. **The Estimator** — voice + document intake → one confirmed `StudentProfile` (frozen, reused verbatim).
2. **The Caller** — live outbound calls vs 3 distinct counsellor styles; itemised quotes logged mid-call via tool calls.
3. **The Closer** — leverage-based negotiation, red-flag detection vs published benchmarks, ranked final report.

## Vertical as config
Everything domain-specific (benchmarks, red-flag rules, negotiation levers, personas) lives in
`config/uk-llb.json`. Swap the file to change vertical — see `config/au-nursing.json` stub.

## Stack
ElevenLabs Agents Platform · Twilio · FastAPI + SQLite (`backend/`) · Next.js (`frontend/`) · OpenAI gpt-4o-mini (doc parsing) · ngrok

## Run
```bash
# Backend
cd backend && python -m venv venv && venv\Scripts\pip install -r requirements.txt
venv\Scripts\uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend && npm install && npm run dev

# Tunnel (agent tool webhooks)
ngrok http 8000
```

Copy `.env.example` → `.env` and fill in keys.

*(Full docs, demo video link, and the four conversation-requirement answers land here in Phase 8.)*
=======
An AI voice agent (ElevenLabs Agents + Twilio) that calls UK study-abroad consultancies on
behalf of a Pakistani student, extracts itemised quotes mid-call, negotiates service fees down
using leverage from competing quotes, and produces a ranked **GBP + PKR** report with transcript
and benchmark evidence.

Built for the ElevenLabs Agents hackathon track.

> **Honesty is the product.** The agent never invents grades, IELTS scores, funds, or fake
> competitor offers. Leverage comes *only* from quotes actually logged in the database, red flags
> are checked against *published* benchmarks, and every call ends in a structured outcome.

---

## What's in the box

| Layer | Tech | Where |
|---|---|---|
| Conversational agents | ElevenLabs Agents (Estimator, Caller, 3 counsellor personas) | `agents/` |
| Tool webhooks + API | FastAPI (Python) | `backend/app/` |
| Storage | SQLite (single file) | `backend/negotiator.db` |
| Dashboard | Next.js 16 · React 19 · Tailwind v4 · Framer Motion · Recharts | `frontend/` |
| Doc parsing | OpenAI `gpt-4o-mini` vision | `backend/app/docparse.py` |
| Vertical knowledge | One JSON config | `config/uk-llb.json` |

## The three modules

1. **The Estimator** — a voice interview and/or document uploads build one `StudentProfile`. Once
   the student confirms, the profile is **frozen** and injected verbatim into every call.
2. **The Caller** — dials consultancies (always your verified number in the demo), logs each fee as
   it is stated, and negotiates using real cross-quote leverage. Every call ends in
   `quote | callback_commitment | documented_decline`.
3. **The Closer** — ranks the quotes, annotates red flags against published deposits and a market
   floor, and produces the final GBP + PKR report (and a downloadable PDF).

## The dashboard (three pages + landing)

The app is a **strict funnel**: the landing page has a single CTA, and a **floating step-flow bar**
(Intake → Caller → Report) is shown below the navbar on the three flow pages (never on `/`). Each
step is *gated on real backend state* so the user can't skip ahead:

- **Caller** unlocks only when a profile is **frozen** (`GET /api/profile.confirmed`).
- **Report** unlocks only when at least one call has **ended** (an outcome in `GET /api/calls`).
- Clicking a locked step doesn't navigate — it shows a tooltip explaining what's required first.
  Completed earlier steps stay clickable (the gating lives in `frontend/lib/flow.ts`).

The pages:

- **`/`** — landing / overview. One primary CTA: **Start student intake**.
- **`/intake`** — first shows a **student picker**: compact cards for every stored student (name,
  city, course, draft/frozen status) plus a prominent **Add new student** button that launches the
  8-step intake wizard. Selecting a student makes it the *current working student* — the caller and
  report then operate on that student. The wizard reviews the Estimator's live data, accepts
  drag-and-drop document uploads (parsed by GPT-4o-mini), validates, and freezes the profile. The
  student's gender selects the Estimator's voice (female voice for female students, else male).
- **`/board`** — the AI caller. Pick one of **three fixed agencies** from a dropdown; the page then
  shows the full call lifecycle (dialing → ringing → call forwarded → connected → ended/declined)
  with agent orb, voice waveform, negotiation-stage timeline, live itemised quote board, confidence
  meter, red flags, and a reconstructed live transcript. A declined/unanswered call can be hung up so
  another agency can be tried. **Every real dial always rings `VERIFIED_TARGET_NUMBER`** — the agency
  is only branding + a mapped persona.
- **`/report`** — an analytics dashboard: summary tiles, an **agencies-contacted side-by-side
  comparison** (fees, deposit, total GBP+PKR, red flags, outcome), comparison + fee-composition
  charts, expandable ranked consultant cards, GBP/PKR currency switch, **Download PDF** and **Print**.

### The three fixed agencies

The caller dropdown lists three agencies defined in `config/uk-llb.json` (`agencies.list`). They are
**realistic but fictional** demo brands, each mapped to one of the three counsellor personas so the
questions asked and data captured stay config-driven and reproducible:

| Agency (display) | Mapped persona | Behaviour |
|---|---|---|
| Britannia Study Abroad | `commission_pusher` | pushes commission universities, dodges itemisation |
| Albion Education UK | `fee_hider` | low headline fee, hidden add-on charges |
| Crownbridge Visa Services | `stonewaller` | refuses prices on the phone, tests AI disclosure |

Rename an agency or change what it asks by editing `display_name`/`tagline` here and the mapped
persona's `quote_sheet`.

## Vertical as config, not code

Everything domain-specific — benchmarks, red-flag rules, negotiation levers, personas, currency,
Estimator voices — lives in `config/uk-llb.json`. Swap the file (see `config/au-nursing.json`) and
set `VERTICAL=<id>` to retarget the whole system. Configs are validated by
`scripts/validate_config.py` against `schemas/vertical-config.schema.json`.

---

## Quickstart (local)

Prerequisites: **Python 3.11+**, **Node 20+**, and a copy of `.env`. A brand-new developer should
follow the step-by-step **[docs/SETUP-GUIDE.md](docs/SETUP-GUIDE.md)** (every env var, ElevenLabs,
Twilio, running, deploying, troubleshooting, and a verification checklist).

```bash
# 1. Secrets
cp .env.example .env         # then fill in the keys you have

# 2. Backend  (http://localhost:8000)
python -m venv .venv
.venv/Scripts/pip install -r backend/requirements.txt      # Windows
# source .venv/bin/activate && pip install -r backend/requirements.txt   # macOS/Linux
# NOTE: do NOT use --reload on Windows (orphaned-worker port bug — see docs/TROUBLESHOOTING.md)
cd backend && python -X utf8 -m uvicorn app.main:app --port 8000

# 3. Frontend  (http://localhost:3000)
cd frontend && npm install && npm run dev
```

Open `http://localhost:3000`. The dashboard talks to the backend at `http://localhost:8000`
(override with `NEXT_PUBLIC_API_BASE`).

The agent tool webhooks (`/tools/*`) need a public HTTPS URL. For local iteration use a tunnel
(ngrok/Cloudflare); for a permanent URL, deploy (see below). Voice minutes are scarce — iterate
agents in **text mode** first.

## Deploy

One EC2 box runs the whole stack behind Caddy (automatic HTTPS on a free `sslip.io` host), so the
**same origin** serves the dashboard *and* the ElevenLabs webhooks — no ngrok in production.

```bash
cd deploy
DOMAIN=<ip-with-dashes>.sslip.io docker compose up -d --build
```

Full walkthrough (instance, networking, SSL, secrets, updates, scaling, cost) in
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

---

## Documentation

| Doc | What's inside |
|---|---|
| [docs/SETUP-GUIDE.md](docs/SETUP-GUIDE.md) | **Start here.** Clone-to-running setup: every env var, ElevenLabs, Twilio, run, deploy, troubleshoot, verify |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System, backend & frontend architecture, folder map, API flow, data model |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Install, run, scripts, frontend & backend guides, design system |
| [docs/API-REFERENCE.md](docs/API-REFERENCE.md) | Every endpoint and every environment variable |
| [docs/CONFIGURATION.md](docs/CONFIGURATION.md) | The vertical config system, field by field |
| [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) | ElevenLabs agents & tools, Twilio, gender-based voice, live FX |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | AWS deployment, HTTPS, secrets, monitoring, scaling, cost |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Common errors, FAQ, maintenance |
| [docs/ACCOUNTS-CHECKLIST.md](docs/ACCOUNTS-CHECKLIST.md) | Accounts/keys you need to obtain |

## Repository layout (top level)

```
backend/     FastAPI app, SQLite db, Dockerfile
frontend/    Next.js dashboard (app router), Dockerfile
agents/      ElevenLabs prompts, tool configs, cue cards, setup guides
config/      Vertical configs (uk-llb.json is active by default)
schemas/     JSON Schemas + examples (profile, quote, vertical config)
scripts/     validate_config, build_call_list, render_agent_prompt, test_closer
deploy/      docker-compose + Caddyfile for one-box AWS deployment
docs/        This documentation set
data/        call_list.json + saved transcripts
```

## Hard rules (judged criteria)

- The agent never invents grades / IELTS / funds / fake competitor offers.
- Leverage comes **only** from `get_leverage` (the database).
- Every call ends in a structured outcome.
- If asked "are you an AI?", the agent discloses honestly.

## License / attribution

Hackathon project. Benchmarks in `config/uk-llb.json` cite their official sources inline.
>>>>>>> 7bd7dbf (improvements by Meer)
