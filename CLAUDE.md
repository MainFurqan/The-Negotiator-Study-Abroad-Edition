# The Negotiator — Study Abroad Edition (ElevenLabs hackathon)

AI agent that gets quotes from UK study-abroad consultancies for Pakistani students,
negotiates fees down using cross-quote leverage, and outputs a ranked GBP+PKR report.

## Read first
- STRATEGY.md — full phase-by-phase plan. Check "Current status" below, do ONE phase per session.

## Architecture (locked — do not re-litigate)
- ElevenLabs Agents (Estimator, Caller, 3 counsellor personas) → tool webhooks → FastAPI (`backend/`) → SQLite → Next.js dashboard (`frontend/`)
- Vertical is CONFIG NOT CODE: everything domain-specific lives in `config/uk-llb.json`.
- Doc parsing: OpenAI gpt-4o-mini vision, isolated in one function.
- Tools exposed to agents: save_profile, log_quote, get_leverage, red_flag_check, end_call_outcome.

## Hard rules (judged criteria)
- Agent NEVER invents grades/IELTS/funds/fake competitor offers. Leverage comes ONLY from get_leverage (DB).
- Every call ends in a structured outcome: quote | callback_commitment | documented_decline.
- If asked "are you an AI?" the agent discloses honestly (behavior set in config).

## Workflow discipline
- Commit + push after every working increment. Never paste large logs into chat — save to file, reference path.
- ElevenLabs voice minutes are scarce: iterate agents in TEXT mode only.
- Windows: use `python -X utf8` for scripts printing non-ASCII.

## Current status
- Phase 0 (foundations/scaffolding): DONE. Next: Phase 1 (vertical config + schemas + call-list script).
