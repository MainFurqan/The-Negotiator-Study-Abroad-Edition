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
- Phase 4 (Caller): code DONE — calls backend (`backend/app/calls.py`: `/tools/log_quote` +
  `/tools/end_call_outcome` with closed-call/enum/detail guards, `POST /api/calls` outbound
  trigger via ElevenLabs Twilio — ALWAYS dials VERIFIED_TARGET_NUMBER, dry_run mode for text
  tests, frozen-profile gate + verbatim `profile_block` injection), live quote board
  `frontend/app/board/` (2s poll, LIVE badge, revised-price strikethrough, GBP+PKR total),
  Caller assets in `agents/caller/` (mechanical extraction script, 2 webhook tool configs,
  README with text-mode relay loop). Verified end-to-end 2026-07-19 via dry-run simulation
  (webhook guards + live board render checked in browser). MANUAL remaining: create Caller
  agent in ElevenLabs (paste system-prompt.md, add both webhook tools, set dynamic-variable
  defaults), Twilio number import → ELEVENLABS_PHONE_NUMBER_ID + VERIFIED_TARGET_NUMBER in
  .env, text-mode relay test vs personas, then the real-call exit test (see agents/caller/README.md).
- Phase 5 (Closer): code DONE — `/tools/get_leverage` (competitor comparisons ONLY from ended
  `quote` calls in SQLite, ready-to-say lever lines from config) + `/tools/red_flag_check`
  (4 check_types: deposit vs published benchmarks / total_charges vs market floor /
  guarantee_claim / pressure_claim; flags persist to red_flags, agent says the returned line)
  in `backend/app/calls.py`; `/api/report` generator (`backend/app/report.py`: ranked GBP+PKR,
  red-flag annotated, savings from revisions, deterministic recommendation); report page
  `frontend/app/report/` (+ board link, board revision-collapse fix); Caller template now has
  NEGOTIATE step + both tool sections (mechanical triggers), rendered; reference tool configs
  `agents/caller/tool.get_leverage.json` + `tool.red_flag_check.json`; eval
  `python -X utf8 scripts/test_closer.py` (17 checks, backs up + restores the DB) ALL PASS
  2026-07-19; report page verified in browser. Twilio number imported in ElevenLabs
  (+1 218 309 4295). MANUAL remaining: add the 2 new webhook tools to the Caller agent
  (ElevenLabs → use FORM view, not JSON mode — see agents/caller/README.md), re-paste updated
  caller system-prompt.md + publish, `ELEVENLABS_PHONE_NUMBER_ID` (phnum_…) into .env,
  text-mode negotiation relay test (README "negotiation test loop"), then the golden calls.
- Development COMPLETE. Next: manual agent config + golden calls + demo recording (Phases 7–8);
  no new code phases unless asked.
