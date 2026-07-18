# The Negotiator — Study Abroad Edition

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
