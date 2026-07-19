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
- Phase 0 (foundations/scaffolding): DONE.
- Phase 1 (vertical config + schemas + call list): DONE — benchmarks verified 2026-07-19 with sources in config;
  schemas in `schemas/` (+ examples); `python -X utf8 scripts/validate_config.py` must stay green;
  `data/call_list.json` built by `scripts/build_call_list.py` (OSM Overpass).
- Phase 2 (Estimator): code DONE — intake backend (`/tools/save_profile`, doc upload → `backend/app/docparse.py`,
  confirm/freeze API), confirmation dashboard (`frontend/app/page.tsx`), agent assets in `agents/estimator/`
  (prompt rendered from config via `scripts/render_agent_prompt.py`). Agent LIVE in ElevenLabs
  (id in .env), webhook verified end-to-end via ngrok, golden transcript at
  `data/transcripts/intake-golden.md`. MANUAL remaining: OPENAI_API_KEY + ELEVENLABS_API_KEY in .env;
  re-paste updated system-prompt.md into ElevenLabs (name/city save fix) and re-publish;
  swap voice Eric → female voice for Sana before demo. Note: ngrok URL changes on restart —
  update the tool URL in ElevenLabs when it does.
- Phase 3 (counterparty market): DONE — persona quote sheets in `config/uk-llb.json`
  (`personas[].quote_sheet`), 3 persona prompts in `agents/persona-*/`, cue cards in
  `agents/cue-cards/`, setup guide `agents/personas-setup.md`. All 3 agents LIVE in ElevenLabs;
  text-mode exit tests PASSED 2026-07-19, transcripts in `data/transcripts/persona-*-textrun.md`.
  Templates were hardened during testing (GPT-4o Mini needs mechanical press-counts / trigger
  checklists, not soft rules — folding AND over-resisting both count as failures). MANUAL
  remaining (optional/pre-demo): re-paste latest rendered Maryam prompt (deposit-leak tightening
  landed after her passing run); Rana bonus dodge run (evade robot question → documented decline).
- Next: Phase 4 (Caller agent + Twilio outbound + log_quote live board).
