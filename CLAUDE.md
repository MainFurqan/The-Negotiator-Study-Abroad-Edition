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
- Production polish pass (2026-07-20): full frontend redesign — dark-first design system
  (`frontend/globals.css` tokens + `components/ui`, `components/shell`), landing `app/page.tsx`,
  animated multi-step intake `app/intake/` (moved off `/`), showpiece live caller `app/board/`
  (waveform/orb/stages/confidence/reconstructed transcript in `components/board`), analytics
  report `app/report/` (Recharts + GBP/PKR switch + PDF/print) using Framer Motion + Recharts +
  Lucide. New backend features (business logic untouched): gender→Estimator voice
  (`GET /api/estimator/session`, schema `gender`, config `estimator.voices`, env
  `ELEVENLABS_VOICE_ID_FEMALE/_MALE`); live FX `backend/app/fx.py` (cache + graceful fallback,
  wired into report + board currency); PDF export `backend/app/report_pdf.py` +
  `GET /api/report/pdf` (reportlab); additive `red_flags` on `GET /api/calls` for the live board.
  `frontend` passes tsc + eslint + `next build`. Full docs in `docs/` (ARCHITECTURE, DEVELOPMENT,
  API-REFERENCE, CONFIGURATION, INTEGRATIONS, DEPLOYMENT, TROUBLESHOOTING). Deploy unchanged model
  (EC2 + Caddy + sslip.io); compose now persists the FX cache on the data volume.
- UX restructure + real agency caller (2026-07-20): all business logic (negotiation/leverage/
  red-flag/report-ranking/docparse/freeze-inject/honesty invariants) UNTOUCHED — verified by
  `scripts/test_closer.py` ALL 17 PASS + `validate_config.py` green after the change.
  (1) Landing `app/page.tsx`: single CTA "Start student intake" (removed "Open live caller").
  (2) Floating gated flow bar: `lib/flow.ts` (gating derived from `/api/profile.confirmed` +
  ended call in `/api/calls`) + `components/shell/flow-bar.tsx` (renders on /intake,/board,/report
  only, NEVER on /); navbar page-links removed from `components/shell/top-nav.tsx`; mounted in
  `app/layout.tsx`. Caller locked until a profile is frozen; Report locked until a call has ended;
  locked clicks show a tooltip, completed steps stay clickable.
  (3) Multi-student: additive `active` column on `student_profile` (db.py migration, at most one
  active; legacy dbs fall back to latest row); `GET /api/profiles`, `POST /api/profiles/{id}/activate`
  (moves the active pointer only — freeze/inject contract intact); `_current`/`_activate` in
  intake.py (aliased `_latest`); `_frozen_profile` in calls.py now injects the ACTIVE student's
  frozen profile (never silently falls back to a different student). Intake `app/intake/` gains a
  student picker (`components/intake/student-picker.tsx`) + "Add new student" (reuses the 8-step
  wizard via `/api/profile/reset`).
  (4) Report `app/report/`: new `components/report/agencies-contacted.tsx` — side-by-side
  comparison (fees/deposit/total GBP+PKR/red flags/outcome) above the existing recommendation;
  ranking logic unchanged.
  (5) Real agency caller (MAIN): 3 fixed agencies in `config/uk-llb.json` `agencies.list`
  (REALISTIC FICTIONAL brands — Britannia Study Abroad→commission_pusher, Albion Education UK→
  fee_hider, Crownbridge Visa Services→stonewaller), schema updated (`schemas/vertical-config.schema.json`
  optional `agencies`). `POST /api/calls` accepts `agency_id` (resolves name+persona; STILL always
  dials VERIFIED_TARGET_NUMBER); new `GET /api/agencies` + `POST /api/calls/{id}/cancel`
  (declined/no-answer → try another agency). Caller page `components/board/agency-caller.tsx`:
  agency dropdown + full lifecycle (dialing→ringing→forwarded→connected→declined/ended), graceful
  dry-run fallback on missing dial env; drives the existing waveform/orb/stages/transcript from the
  real selected-agency call via polling. Old `start-call.tsx` (persona/call_list picker) removed.
  `frontend` passes tsc + eslint + `next build`; all pages click-through verified in browser; demo
  DB left intact (test rows cleaned up). New setup guide `docs/SETUP-GUIDE.md`; docs refreshed
  (README, ARCHITECTURE, DEVELOPMENT, API-REFERENCE, CONFIGURATION, INTEGRATIONS, TROUBLESHOOTING).
  MANUAL remaining unchanged from Phase 5 (ElevenLabs Caller agent config + phone id in .env +
  golden calls); no ElevenLabs/Twilio setup changed by this restructure.
