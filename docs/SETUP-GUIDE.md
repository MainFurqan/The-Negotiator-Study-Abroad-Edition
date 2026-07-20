# Setup & Integration Guide

> **Audience:** a developer who has just cloned this repository and knows nothing about the project.
> By the end you will have the backend, the frontend, ElevenLabs, and Twilio all working end‑to‑end,
> and you will understand every credential the system needs and where it goes.

This guide reflects the **actual implementation** in this repo (FastAPI + SQLite backend in `backend/`,
Next.js 16 / React 19 frontend in `frontend/`, config‑driven vertical in `config/uk-llb.json`,
ElevenLabs Agents + Twilio for the phone calls).

---

## 0. What this project is (30‑second version)

"The Negotiator" is an AI voice agent that:

1. **Intake** — interviews a student (voice + document upload) and builds ONE verified, frozen
   `StudentProfile`.
2. **Caller** — phones study‑abroad consultancies, itemises every fee live, and negotiates the price
   down using *real* cross‑quote leverage pulled from the database (never fabricated).
3. **Report** — produces a deterministic, ranked GBP + PKR comparison with red flags annotated
   against published benchmarks.

**The most important safety rule in the whole system:** every real outbound phone call **always dials
`VERIFIED_TARGET_NUMBER`** (your own verified phone), regardless of which agency the UI shows. The demo
never cold‑dials a real consultancy. This is enforced in `backend/app/calls.py` — the `to_number`
sent to ElevenLabs is *hard‑coded to read that one env var*.

---

## 1. Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Python | 3.11+ | Backend. On Windows always run scripts with `python -X utf8 …` (see Troubleshooting). |
| Node.js | 20+ | Frontend (Next.js 16, React 19). |
| npm | 10+ | Ships with Node. |
| A tunnel | ngrok (or Cloudflare Tunnel) | ElevenLabs tool webhooks must reach your local backend over HTTPS. |
| Accounts | ElevenLabs, Twilio, OpenAI | See sections 3–5. Google Places is optional. |

---

## 2. Environment variables — every variable, one by one

All backend variables live in a single **`.env` file at the repository root** (loaded by
`backend/app/main.py` via `python-dotenv`). Copy the template and fill it in:

```bash
cp .env.example .env
```

> ⚠️ **Never commit `.env`.** It is git‑ignored. The values below are examples only — use your own.

The frontend uses a **separate** mechanism: a single build‑time public variable (section 2.4).

### 2.1 ElevenLabs variables

| Variable | Mandatory? | What it is | Where to get it | Example |
|----------|-----------|------------|-----------------|---------|
| `ELEVENLABS_API_KEY` | **Yes** (for real calls / voice) | Your ElevenLabs API key. Authenticates the outbound‑call request and voice sessions. | ElevenLabs dashboard → Profile → **API Keys**. | `sk_xxxxxxxx…` |
| `ELEVENLABS_AGENT_ID_CALLER` | **Yes** (for real calls) | The Agent that makes the negotiation call. | ElevenLabs → **Agents** → your Caller agent → copy its `agent_…` id. | `agent_7901kx…` |
| `ELEVENLABS_AGENT_ID_ESTIMATOR` | Optional | The Estimator (intake) agent id — used by `GET /api/estimator/session` to launch the voice interview. | ElevenLabs → Agents → Estimator. | `agent_0001kx…` |
| `ELEVENLABS_AGENT_ID_PERSONA_COMMISSION` | Optional | Simulated "commission pusher" counsellor agent (text‑mode testing only). | ElevenLabs → Agents. | `agent_3501kx…` |
| `ELEVENLABS_AGENT_ID_PERSONA_FEEHIDER` | Optional | Simulated "fee hider" counsellor agent. | ElevenLabs → Agents. | `agent_3101kx…` |
| `ELEVENLABS_AGENT_ID_PERSONA_STONEWALL` | Optional | Simulated "stonewaller" counsellor agent. | ElevenLabs → Agents. | `agent_5201kx…` |
| `ELEVENLABS_PHONE_NUMBER_ID` | **Yes** (for real calls) | The ElevenLabs Phone Number id created when you import your Twilio number. This is the *caller ID* the agent dials **from**. | ElevenLabs → **Phone Numbers** → import Twilio → copy the `phnum_…` id. | `phnum_5001kx…` |
| `ELEVENLABS_VOICE_ID_FEMALE` | Optional | Voice id used for the Estimator when the student's gender is `female`. | ElevenLabs → **Voices** → copy a voice id. | `EXAVITQu…` |
| `ELEVENLABS_VOICE_ID_MALE` | Optional | Voice id used for the Estimator for every other gender value. | ElevenLabs → Voices. | `TxGEqnHW…` |

If the voice ids are blank the Estimator simply uses whatever voice the agent is configured with in
ElevenLabs — nothing breaks.

### 2.2 Twilio variables

| Variable | Mandatory? | What it is | Where to get it | Example |
|----------|-----------|------------|-----------------|---------|
| `TWILIO_ACCOUNT_SID` | **Yes** (for real calls) | Your Twilio account id. Needed by ElevenLabs to import the number. | Twilio Console → **Account Info**. | `ACxxxxxxxx…` |
| `TWILIO_AUTH_TOKEN` | **Yes** (for real calls) | Twilio auth token (secret). | Twilio Console → Account Info (click "show"). | `a151…` |
| `TWILIO_PHONE_NUMBER` | **Yes** (for real calls) | The Twilio number you purchased/claimed (E.164). This is the number ElevenLabs dials **from**. | Twilio Console → **Phone Numbers** → Active numbers. | `+12183094295` |
| `VERIFIED_TARGET_NUMBER` | **Yes** (for real calls) | **The number every call is dialed TO.** Your own phone, verified in Twilio. This is the demo‑safety anchor. | Twilio Console → **Verified Caller IDs** → verify your phone; then paste it here in E.164. | `+9232xxxxxxxx` |

### 2.3 OpenAI + tunnel + optional

| Variable | Mandatory? | What it is | Where to get it | Example |
|----------|-----------|------------|-----------------|---------|
| `OPENAI_API_KEY` | Optional (only for document upload OCR) | Key for `gpt-4o-mini` vision, used by `backend/app/docparse.py` to parse uploaded transcripts / IELTS / bank statements. | platform.openai.com → API keys. | `sk-proj-…` |
| `PUBLIC_BASE_URL` | **Yes** (for ElevenLabs webhooks) | The public HTTPS URL that ElevenLabs tool webhooks call back into your local backend. Set it to your ngrok URL, **no trailing slash**. Changes every time ngrok restarts. | Output of `ngrok http 8000`. | `https://xxxx.ngrok-free.dev` |
| `GOOGLE_PLACES_API_KEY` | Optional | Used only by `scripts/build_call_list.py` to build the real call list; OSM Overpass (free, keyless) is used if empty. | Google Cloud console. | *(blank)* |
| `FX_DISABLE` | Optional | `1` forces the static config GBP→PKR rate (offline demos). | — | *(blank)* |
| `FX_TTL_SECONDS` | Optional | Cache TTL for the live FX rate (default `21600` = 6h). | — | *(blank)* |
| `NEGOTIATOR_FX_CACHE` | Optional | Path to persist the FX cache (e.g. `/data/fx_cache.json` in prod). | — | *(blank)* |
| `NEGOTIATOR_DB` | Optional | Path to the SQLite file; defaults to `backend/negotiator.db`. Point at a mounted volume in prod. | — | *(blank)* |
| `ALLOWED_ORIGINS` | Optional | Comma‑separated CORS origins; default `http://localhost:3000`. | — | *(blank)* |
| `VERTICAL` | Optional | Which `config/<id>.json` to load; default `uk-llb`. | — | *(blank)* |

### 2.4 Frontend variable (separate from `.env`)

The frontend reads exactly **one** public variable at build time:

| Variable | Mandatory? | What it is | Where it goes |
|----------|-----------|------------|---------------|
| `NEXT_PUBLIC_API_BASE` | Optional | Base URL of the FastAPI backend the browser calls. Defaults to `http://localhost:8000`. Set to empty string for same‑origin production behind Caddy. | `frontend/.env.local` (dev) or the container build arg (prod). |

Create `frontend/.env.local` if you need to override it:

```
NEXT_PUBLIC_API_BASE=http://localhost:8000
```

---

## 3. ElevenLabs setup (step by step)

1. **Create an account** at elevenlabs.io and choose a plan with the **Agents Platform** and
   **outbound phone calls** enabled.
2. **Get the API key:** Profile → API Keys → create → paste into `.env` as `ELEVENLABS_API_KEY`.
3. **Create the Caller agent** (Agents → New agent, name it "Caller"):
   - **System prompt:** paste the rendered `agents/caller/system-prompt.md`
     (regenerate it with `python -X utf8 scripts/render_agent_prompt.py`).
   - **Dynamic variables** (the backend sends these on every call — set placeholder defaults so you
     can test in chat):
     - `call_id` — the DB call row id (webhooks attach quotes/flags to it).
     - `consultancy_name` — the agency display name the agent asks for.
     - `student_profile` — the frozen profile block, injected verbatim.
   - **First message:** leave **empty** (the consultancy answers first). If the platform forces one,
     use `"Assalam o alaikum, am I through to {{consultancy_name}}?"`.
   - **Tools → Add tool → Webhook**, add all **four** using the reference JSON in `agents/caller/`
     (`tool.log_quote.json`, `tool.end_call_outcome.json`, `tool.get_leverage.json`,
     `tool.red_flag_check.json`). Replace `{PUBLIC_BASE_URL}` with your ngrok URL.
     - **Use the Form view, NOT JSON mode** — ElevenLabs' JSON editor uses a different internal
       schema. Transcribe name / description / URL / each body parameter; tick the ones listed in the
       JSON's `required` array; set each parameter's value type to **LLM Prompt**.
   - Copy the agent id (`agent_…`) → `.env` as `ELEVENLABS_AGENT_ID_CALLER`.
4. **(Optional) Estimator + persona agents:** same flow; the Estimator uses `tool.save_profile.json`;
   the three persona agents (`agents/persona-*/`) are only for free text‑mode negotiation tests.
5. **Import the phone number** (after Twilio setup, section 4): Phone Numbers → Import (Twilio) →
   copy the `phnum_…` id → `.env` as `ELEVENLABS_PHONE_NUMBER_ID`.
6. **(Optional) voices:** Voices → pick a female and a male voice → copy ids →
   `ELEVENLABS_VOICE_ID_FEMALE` / `ELEVENLABS_VOICE_ID_MALE`.

**Verify ElevenLabs is connected:** with the backend up and `PUBLIC_BASE_URL` set, open the Caller
agent's Test/chat tab and confirm the four webhook tools resolve to your ngrok URL. A real end‑to‑end
check is in the Verification Checklist (section 9).

---

## 4. Twilio setup (step by step)

1. **Create a Twilio account** (a trial account is fine — and is actually *ideal* here, because a
   trial can only call **verified** numbers, which reinforces our safety rule).
2. **Buy / claim a phone number** with **Voice** capability: Console → Phone Numbers → Buy a number.
   Paste it into `.env` as `TWILIO_PHONE_NUMBER` (E.164, e.g. `+12183094295`).
3. **Verify your own phone** as a Verified Caller ID: Console → Phone Numbers → Verified Caller IDs →
   Add → verify by call/SMS. Paste your phone into `.env` as `VERIFIED_TARGET_NUMBER` (E.164).
   **This is the number every call rings.**
4. **Copy your credentials:** Console → Account Info → `Account SID` and `Auth Token` →
   `.env` as `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN`.
5. **Connect Twilio to ElevenLabs:** in ElevenLabs → Phone Numbers → Import number → choose Twilio →
   paste the SID, Auth Token, and the Twilio number → save → copy the resulting `phnum_…` id into
   `ELEVENLABS_PHONE_NUMBER_ID`. **ElevenLabs manages the Twilio voice webhooks for you** once the
   number is imported — you do not configure a Twilio voice URL by hand.
6. **How Twilio connects to a call:** the backend calls the ElevenLabs *Twilio outbound‑call* API
   (`POST https://api.elevenlabs.io/v1/convai/twilio/outbound-call`) with `agent_id`,
   `agent_phone_number_id` (= `ELEVENLABS_PHONE_NUMBER_ID`), and `to_number`
   (= `VERIFIED_TARGET_NUMBER`). ElevenLabs then places the call through Twilio.

**Testing outbound calls / common mistakes:**
- Trial account + un‑verified target → the call silently fails. Verify the number first.
- `to_number` / `TWILIO_PHONE_NUMBER` not in **E.164** (`+<country><number>`, no spaces) → rejected.
- Number imported into ElevenLabs but the `phnum_…` id not copied into `.env` → `409` "cannot dial".

---

## 5. Other third‑party services

| Service | Why | Credentials | Used where |
|---------|-----|-------------|-----------|
| **OpenAI** | Document OCR/parsing for intake uploads (`gpt-4o-mini` vision). | `OPENAI_API_KEY` | `backend/app/docparse.py` (imported lazily — only needed when a document is uploaded). |
| **ngrok** (or any HTTPS tunnel) | ElevenLabs tool webhooks must reach your local backend over public HTTPS. | none (free tier fine) | `PUBLIC_BASE_URL` in `.env`; paste the URL into the four Caller webhook tools. |
| **open.er-api.com** | Live GBP→PKR FX rate (keyless, no signup). | none | `backend/app/fx.py`; falls back to the config rate offline. |
| **Google Places** (optional) | Build a real call list of consultancies. | `GOOGLE_PLACES_API_KEY` | `scripts/build_call_list.py`; OSM Overpass used if blank. |

> **Note on ngrok:** the URL changes on every restart. When it changes you must (a) update
> `PUBLIC_BASE_URL` in `.env` and (b) re‑paste the new URL into all four Caller webhook tools in
> ElevenLabs. This is the single most common source of "the agent isn't logging quotes" bugs.

---

## 6. Running locally

### 6.1 Backend (FastAPI, port 8000)

```bash
cd backend
python -m venv .venv
# Windows PowerShell:  .venv\Scripts\Activate.ps1
# Git Bash:            source .venv/Scripts/activate
pip install -r requirements.txt
# Do NOT use --reload on Windows (orphaned-worker port bug — see TROUBLESHOOTING.md):
python -m uvicorn app.main:app --port 8000
```

The DB (`backend/negotiator.db`) auto‑creates on startup (`init_db()`), including additive column
migrations. Health check: open `http://localhost:8000/health`.

### 6.2 Tunnel (for ElevenLabs webhooks)

```bash
ngrok http 8000
# copy the https URL into .env as PUBLIC_BASE_URL (no trailing slash),
# and into the four Caller webhook tools in ElevenLabs.
```

### 6.3 Frontend (Next.js, port 3000)

```bash
cd frontend
npm install
npm run dev     # http://localhost:3000
```

### 6.4 Validate config (must stay green)

```bash
python -X utf8 scripts/validate_config.py
```

This validates every `config/*.json` against `schemas/vertical-config.schema.json` and the example
instances against their schemas. **Exit 0 is a hard requirement** — CI/demo gate.

### 6.5 Closer eval (optional but recommended)

```bash
python -X utf8 scripts/test_closer.py     # 17 checks; backs up + restores the DB
```

### 6.6 Testing the full call flow (dry‑run, zero voice minutes)

1. Backend + frontend up.
2. Go to `http://localhost:3000` → **Start student intake** → complete the 8 steps → **freeze** the
   profile (this is the gate: no call is possible until a profile is frozen).
3. Go to the **Caller** page → pick an **agency** from the dropdown → start a **dry‑run** call.
4. Exercise the Caller agent in ElevenLabs text mode (relay against a persona agent — see
   `agents/caller/README.md`). Watch quotes / red flags appear live on the board.
5. Open the **Report** page → confirm the agencies‑contacted comparison + ranked recommendation.

For a **real** call: freeze a profile, pick an agency, start with dry‑run **off** — your
`VERIFIED_TARGET_NUMBER` rings; play the persona from its cue card (`agents/cue-cards/`).

---

## 7. Deployment

The reference deploy is EC2 + Docker Compose + Caddy (see `deploy/` and `docs/DEPLOYMENT.md`).

**Production env vars:** the same `.env` at the repo root, plus:
- `NEGOTIATOR_DB=/data/negotiator.db` (persistent volume).
- `NEGOTIATOR_FX_CACHE=/data/fx_cache.json` (persist the FX cache).
- `ALLOWED_ORIGINS=https://<your-domain>`.
- Frontend built with `NEXT_PUBLIC_API_BASE=""` (same‑origin behind Caddy) or the API's public URL.

**Deployment order:**
1. Provision the host + volume; put `.env` in place.
2. `docker compose up -d --build` (backend, frontend, Caddy).
3. Point DNS / sslip.io at the host; Caddy issues TLS automatically.
4. **Webhook update:** in production the backend has a stable HTTPS URL — set `PUBLIC_BASE_URL` to it
   and update the four Caller webhook tools in ElevenLabs to that URL (no more ngrok churn).
5. Re‑import / re‑confirm the ElevenLabs phone number id if the environment changed.

**Production checklist:**
- [ ] `.env` present with all mandatory vars (section 2).
- [ ] `python -X utf8 scripts/validate_config.py` green.
- [ ] `/health` returns `{status: "ok"}`.
- [ ] Four Caller webhook tools point at the production URL.
- [ ] `VERIFIED_TARGET_NUMBER` is correct — **triple‑check; every call dials it.**
- [ ] FX cache volume mounted; DB volume mounted.

---

## 8. Troubleshooting (most common setup mistakes)

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Agent doesn't log quotes / webhooks 404 | ngrok URL changed | Update `PUBLIC_BASE_URL` **and** all four Caller webhook tools. |
| `409 cannot dial — set [...] in .env` | A dial env var is missing | Fill `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID_CALLER`, `ELEVENLABS_PHONE_NUMBER_ID`, `VERIFIED_TARGET_NUMBER`. The frontend falls back to dry‑run so the demo never hard‑crashes. |
| `502 ElevenLabs outbound call failed` | Bad key / agent id / phone id, or Twilio target not verified | Re‑check the four vars; verify the target number in Twilio. |
| Call never rings | Twilio trial + un‑verified target, or non‑E.164 number | Verify the number; use `+<country><number>`. |
| `401` from ElevenLabs | Invalid `ELEVENLABS_API_KEY` | Regenerate the key. |
| Backend won't restart / port 8000 busy | Orphaned uvicorn `--reload` worker (Windows) | Don't use `--reload`; kill stray `python.exe`; see TROUBLESHOOTING.md. |
| Non‑ASCII crash running a script | Windows default codepage | Always run `python -X utf8 scripts/...`. |
| Frontend can't reach backend | `NEXT_PUBLIC_API_BASE` wrong / CORS | Set it in `frontend/.env.local`; set `ALLOWED_ORIGINS` on the backend. |
| Env vars "not loading" | Editing `.env.example` instead of `.env`, or backend started before `.env` existed | Edit `.env`; restart the backend (it loads `.env` at import time). |
| Document upload 422 | `OPENAI_API_KEY` missing/invalid | Set the key (only needed for uploads). |
| Config validation fails | New config key not in schema | Update `schemas/vertical-config.schema.json` too. |

---

## 9. Verification checklist

Work top to bottom; each line should pass before the next.

- [ ] **Env loaded** — `/health` returns `{ "status": "ok", "vertical": "uk-llb", … }`.
- [ ] **Config validates** — `python -X utf8 scripts/validate_config.py` prints "All valid." (exit 0).
- [ ] **Backend starts** — `uvicorn app.main:app --port 8000` with no traceback.
- [ ] **Frontend starts** — `npm run dev`, landing page loads at `:3000`.
- [ ] **Tunnel up** — `PUBLIC_BASE_URL` reachable; four Caller webhooks point at it.
- [ ] **ElevenLabs connected** — Caller agent test chat resolves the webhook tools; `/api/agencies`
      lists the three agencies.
- [ ] **Twilio connected** — ElevenLabs Phone Numbers shows the imported number;
      `ELEVENLABS_PHONE_NUMBER_ID` set.
- [ ] **Dry‑run works** — freeze a profile → pick an agency → dry‑run call → quotes appear on the board
      → outcome logged → report shows the comparison.
- [ ] **Real call works** — dry‑run off → your `VERIFIED_TARGET_NUMBER` rings → the board fills live →
      the call ends in a structured outcome.

---

*This guide is generated after a full review of the existing codebase and is kept consistent with the
behaviour described in `README.md` and the rest of `docs/`.*
