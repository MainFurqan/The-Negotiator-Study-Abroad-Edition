# THE NEGOTIATOR — Study Abroad Edition
## End-to-End Development Strategy (Co-Founder Master Plan)

> Hack-Nation 6th Global AI Hackathon · ElevenLabs Track
> Vertical: Pakistan → UK (LLB) · Timeline: 8+ days · Team: solo builder + Claude Code
> Constraints: ElevenLabs free tier (10,000 credits ≈ ~15 min of agent conversation/month), Twilio trial, Claude Code 5-hour rolling limit (no budget for overage).

---

## 0. The One-Sentence Winning Thesis

We win by demonstrating a **price that measurably moves during a live phone call** because of leverage our agent gathered — everything else (dashboard, OCR, configs) exists to make that moment credible, repeatable, and evidence-backed.

The brief says it plainly: *"This challenge is won in call design, not model architecture."* We spend ~50% of effort on conversation design and personas, ~30% on the pipeline, ~20% on UI/report.

---

## 1. Architecture (locked)

```
                        ┌──────────────────────────────────────┐
                        │       ElevenLabs Agents Platform      │
                        │                                      │
  Student ──voice──►    │  [Estimator Agent]  (intake interview)│
  Student ──docs───►    │                                      │
                        │  [Caller/Closer Agent] (outbound)     │──Twilio──► Phone (you role-playing
                        │                                      │            3 counsellor styles /
                        │  [3 Counsellor Persona Agents]        │            real consultancy later)
                        └───────────┬──────────────────────────┘
                                    │  agent tools (webhooks)
                                    ▼
                        ┌──────────────────────────────────────┐
                        │   FastAPI backend  (Python)           │
                        │   - /tools/log_quote  (mid-call)      │
                        │   - /tools/get_leverage               │
                        │   - /tools/red_flag_check             │
                        │   - /tools/end_call_outcome           │
                        │   - SQLite: profiles, calls, quotes   │
                        │   - config/uk-llb.json  (the vertical)│
                        └───────────┬──────────────────────────┘
                                    │  REST
                                    ▼
                        ┌──────────────────────────────────────┐
                        │   Next.js dashboard                   │
                        │   - Profile intake & confirmation     │
                        │   - Live quote board (fills mid-call) │
                        │   - Ranked report (GBP + PKR)         │
                        │   - Transcript/recording evidence     │
                        └──────────────────────────────────────┘
```

**Stack decisions (final — do not relitigate):**

| Layer | Choice | Why |
|---|---|---|
| Voice agents | ElevenLabs Agents Platform | Required by track; system prompts + tools + knowledge base built in |
| Telephony | ElevenLabs native Twilio integration | "Real Twilio calls" with zero custom SIP code |
| Backend | Python FastAPI + SQLite | Your comfort zone; webhooks for agent tools; zero DB setup |
| Frontend | Next.js (single dashboard page + report page) | Your comfort zone; judges love a live-updating quote board |
| Doc parsing | OpenAI `gpt-4o-mini` (vision) | We have OpenAI credits; cheap, reliable JSON mode; swappable behind one function |
| Tunnel | ngrok free | Expose local FastAPI tool webhooks to ElevenLabs |
| Config | `config/uk-llb.json` | The brief REQUIRES vertical-as-config; this is a judged criterion |

**The vertical config is a first-class deliverable.** Everything market-specific lives in `config/uk-llb.json`: profile taxonomy, university deposit benchmarks, red-flag rules, negotiation levers, counsellor persona parameters, currency pair. We will demo "swap the config" by showing a stub `config/australia-nursing.json`.

---

## 2. Counterparty Strategy (the risk decision)

Three tiers, all supported by the same code path:

1. **Tier A — demo backbone (required):** Agent-to-agent simulated market. 3 ElevenLabs persona agents: **the Commission Pusher** (only quotes Hull/UWE, £8.5k–£10k deposits), **the Fee-Hider** ("counselling is free", reveals courier/embassy/file-processing fees only when pressed), **the Stonewaller** ("come to the office, bring documents"). Repeatable, cheap to record once as golden calls.
2. **Tier B — the wow moment (required):** Real Twilio PSTN calls to **your verified phone**; you role-play the personas using persona cue cards (we'll write them). This satisfies "real Twilio calls" + "live calls against 3 distinct styles" with zero consent risk.
3. **Tier C — stretch (optional, only if everything else is done):** Upgrade Twilio (~$20), enable Pakistan geo-permissions, one genuine consultancy call with your real profile. Only attempt after Tier A+B are recorded and safe.

**ElevenLabs credit rationing (this is survival, not optimization):**
- All agent iteration happens in **text mode** in the ElevenLabs dashboard chat tester — voice minutes are spent only on (a) final persona tuning, (b) golden-call recordings, (c) the live demo.
- Budget: ~15 min/month free. Allocation: 3 min intake golden call, 3×2.5 min quote calls, 3 min negotiation golden call, ~1.5 min buffer. **Record every good call immediately** — a golden recording never needs re-spending.
- If we run dry: second free account for personas (counterparty agents are separate anyway), or the demo video uses the recordings we already banked.

---

## 3. Phases

### Phase 0 — Foundations (Day 1 morning, one Claude Code session)
- `git init`, create private GitHub repo, first push. **Git is our checkpoint system** — it's what makes `/clear` safe.
- Write `.claudeignore`, `.gitignore`, `.env.example`, `CLAUDE.md` (see §5).
- Accounts checklist: ElevenLabs (done ✓, 10k credits), Twilio trial + verify your phone number, ngrok, OpenAI API key (credits available), Google Places API key (optional — $200 free credit) or OSM Overpass (free).
- Scaffold: `backend/` (FastAPI hello + SQLite models), `frontend/` (Next.js starter), `config/uk-llb.json` (empty schema).
- **Exit criteria:** repo pushed; FastAPI runs; Next.js runs; config schema agreed.

### Phase 1 — Data Foundation & Vertical Config (Day 1 afternoon)
- Fill `config/uk-llb.json` with **real benchmarks** (cite sources in the file):
  - Deposits: QMUL £2,000 · Manchester £6,000 · UWE Bristol £8,500 · Hull £10,000 (from the brief; verify on university pages and add 3–4 more).
  - UKVI maintenance funds requirement (verify current figures on gov.uk), IELTS fee in PKR, visa fee, typical LLB tuition range.
  - Red-flag rules as data: `deposit > published_deposit → "padding"`, `total < market_floor → "hidden fees or low-quality institution"`, `service_fee_free_but_addons → "fee-hider pattern"`.
  - Negotiation levers as data: match-lower-deposit, waive-service-fee, deposit-instalment, scholarship-ask.
- Define the two core schemas: `StudentProfile` JSON and `ItemisedQuote` JSON (tuition/yr, initial deposit, service fee, application+embassy+courier, IELTS/medical, bank statement requirement, living costs, university name, conditions).
- Call-list script: pull education consultants for Lahore/Faisalabad/Islamabad from Google Places (or OSM) into `data/call_list.json` — proves real-world discoverability; the demo dials our numbers but the list is real.
- **Exit criteria:** config validates against a JSON schema; call list generated; committed & pushed.

### Phase 2 — The Estimator (Day 2)
- **Voice intake agent** (ElevenLabs): asks what a professional counsellor asks — last qualification, grades, English test status, target degree/country, budget ceiling, sponsor + bank statement capacity, intake season. Tool call `save_profile` posts structured JSON to FastAPI. Iterate in TEXT mode.
- **Document intake:** upload transcript/IELTS TRF/bank statement (or an existing consultancy quote) → OpenAI vision → **same** `StudentProfile` schema. One document type is required; transcripts + IELTS = two, better.
- **Confirmation step (judged requirement):** dashboard shows the merged profile; student explicitly confirms before any call. Profile is then **frozen** and injected verbatim into every outbound call prompt.
- **Exit criteria:** both paths produce identical schema; confirmation UI works; one text-mode golden intake transcript saved.

### Phase 3 — The Counterparty Market (Day 3)
- Build the 3 persona agents in ElevenLabs, each parameterized by a persona block in the config (partner universities, commission bias, fee-hiding behavior, evasion tactics).
- Write **human role-play cue cards** for the same 3 personas (for Tier B Twilio calls) — one page each: opening line, what they push, what they hide, when they concede.
- Persona quality bar: the Fee-Hider must *actually* conceal fees until pressed twice; the Stonewaller must *actually* refuse numbers until the agent applies the "my family needs an itemised budget before any visit" move. If personas fold instantly, the negotiation looks scripted — the #1 "weak submission" trap.
- **Exit criteria:** 3 text-mode agent-vs-persona conversations where extraction is *hard but succeeds*.

### Phase 4 — The Caller (Day 4)
- Outbound orchestration: FastAPI endpoint triggers ElevenLabs outbound call (Twilio integration) per call-list entry; conversation state tied to `call_id`.
- Caller agent prompt: identical profile description every time; friction handling (interruptions, "visit our office", vague answers); **mid-call tool** `log_quote` writes each fee item to SQLite as it's extracted → the dashboard quote board fills **live during the call** (huge demo moment).
- Structured outcome enforcement: every call ends via `end_call_outcome` tool — `quote | callback_commitment | documented_decline`. Never "around 50 lakh".
- AI disclosure behavior: discloses on request, gracefully, without losing the quote (scripted recovery line — we design and demo this explicitly, it's a judged bullet).
- **Exit criteria:** one real Twilio call to your phone completes end-to-end with a live-logged itemised quote.

### Phase 5 — The Closer (Day 5)
- Negotiation tools: `get_leverage(call_id)` returns the best competing itemised offer from SQLite; agent uses it truthfully ("Another firm offers the same LLB pathway with a £2,000-deposit university and no service fee — can you match it?").
- **Honesty guardrails (judged):** system prompt hard constraints — never invent grades/IELTS/funds; **leverage may only come from the `get_leverage` tool**, never fabricated; `red_flag_check` tool validates quoted deposits against published benchmarks and the agent *says so on the call* ("Manchester's published deposit for Pakistani applicants is £6,000 — why is your figure £8,000?").
- Report generator: ranked comparison, itemised GBP + PKR, red flags annotated, recommended pathway in plain language, every claim linked to a transcript timestamp + recording.
- **Exit criteria:** one call where price/terms measurably change due to tool-fetched leverage (e.g., service fee waived or lower-deposit university surfaced) — recorded.

### Phase 6 — Dashboard & Report Polish (Day 6)
- Live quote board (rows appear mid-call), comparison table, ranked report page, audio player per call, transcript viewer with highlighted evidence, "swap vertical" config toggle stub.
- Keep it clean, not fancy — the brief explicitly warns against hiding non-comparable quotes behind a polished dashboard. Comparability IS the feature.

### Phase 7 — Golden Calls, Evals & Hardening (Day 7)
- Record the full golden set: intake (voice), 3 style calls (Twilio-to-you), 1 negotiation with price movement, 1 "am I talking to a robot?" moment, 1 stonewall → documented-decline outcome.
- Simple evals (scriptable, cheap): does the caller extract all 8 fee items? does `red_flag_check` fire on a padded deposit? does the closer refuse to fabricate when persona baits it ("your other offer is fake, right?")?
- Failure-mode drills: mid-call hangup, persona giving a range instead of numbers, barge-in.

### Phase 8 — Demo & Submission (Day 8 + buffer)
- **Demo video structure (3–5 min):** Ali's problem (15s) → intake both paths + confirmation (45s) → live call montage vs 3 styles with the quote board filling (90s) → THE negotiation moment, price moves on screen (60s) → ranked report, GBP/PKR, red flags, evidence links (45s) → config-swap slide + honesty/disclosure slide (20s).
- README: architecture diagram, the 4 conversation-requirement answers (disclosure, friction, honesty line, structured endings) answered explicitly — they're judged bullets, put them under literal headings.
- Pre-recorded full run as fallback; live demo only if the venue/network allows.
- Buffer day for the unknown-unknowns. There will be some.

---

## 4. Success-Criteria Traceability (check before submitting)

| Judged criterion | Where we satisfy it |
|---|---|
| Closed loop, single vertical end-to-end | Phases 2→5, demo video |
| One profile, voice + ≥1 doc, confirmed, reused verbatim | Phase 2 confirmation freeze |
| Live calls vs ≥3 distinct styles, structured comparable quotes | Phases 3–4, Tier B Twilio calls |
| Price measurably changes from gathered leverage | Phase 5 golden negotiation call |
| AI disclosure + honesty constraints + graceful friction | Phase 5 guardrails + Phase 7 drills |
| Every call ends in structured outcome | `end_call_outcome` tool (Phase 4) |
| Report: ranked, GBP+PKR, transcript-cited, plain language | Phases 5–6 |
| Vertical as config, not code | `config/uk-llb.json` + stub second vertical |

---

## 5. Claude Code Discipline (our token budget IS our runway)

**Session rules:**
1. **One phase-chunk per session.** Start each session by pointing me at `STRATEGY.md` + the current phase. End each session with commit + push.
2. **`/clear` between phases** (new topic = fresh context; git + this file are the memory). **`/compact` mid-phase** only when a session must continue past a long exploration — compact at a natural milestone (e.g., "backend done, starting frontend"), never mid-debug.
3. **Commit + push at every working increment** (several times per session). A pushed commit makes any context loss recoverable and any bad change revertible. Message format: `phase-N: what works now`.
4. **Plan-first for anything non-trivial:** ask me for a short plan, approve it, then let me implement in one pass. Rework burns 3× the tokens of planning.
5. **Never paste large logs/transcripts into chat** — save them to a file and tell me the path; I'll read only what I need.
6. **Don't ask me to re-explain the project** — say "read CLAUDE.md" (kept short) instead.

**`.claudeignore`** (keep my context lean): `node_modules/`, `.next/`, `venv/`, `__pycache__/`, `*.mp3 *.wav *.m4a` (recordings), `*.pdf`, `package-lock.json`, `data/recordings/`, `.env`, SQLite db files.

**`.gitignore`**: `.env`, `venv/`, `node_modules/`, `.next/`, `__pycache__/`, `*.db`, `data/recordings/` (recordings go to a local folder or Drive, not git).

**`CLAUDE.md`** (≤30 lines): what the product is (2 lines), stack, folder map, schema file locations, "config not code" rule, run commands, current phase pointer.

---

## 6. Risk Register

| Risk | Mitigation |
|---|---|
| ElevenLabs minutes exhausted | Text-mode iteration; golden recordings banked early; second free account for personas |
| Twilio trial limits | Tier B design (call your verified phone); $20 upgrade only for optional Tier C |
| Negotiation looks scripted | Personas engineered to resist (Phase 3 quality bar); leverage comes from live tool calls, visible in logs |
| ngrok tunnel dies during demo | Pre-recorded fallback video; ngrok static domain (free tier offers one) |
| Claude Code limit hit mid-phase | Everything pushed to git; STRATEGY.md + CLAUDE.md let any fresh session resume in minutes |
| Doc parsing flaky on real scans | Constrain to 2 doc types; few-shot the exact schema; manual-edit fallback in confirmation UI (which we need anyway) |

---

*Owner: you. Architect/pair: Claude Code. Update the "current phase" line in CLAUDE.md as we go.*
