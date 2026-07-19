# Caller agent — setup, text-mode testing, and the real Twilio call

The Caller (Phases 4+5) phones consultancies, extracts an itemised quote, logs every figure
mid-call via `log_quote` (the dashboard board fills live), negotiates with `get_leverage`
(DB-sourced comparisons only), challenges padded figures with `red_flag_check`, and ends every
call through `end_call_outcome`. Iterate in TEXT mode; voice/Twilio minutes are for the golden
calls only.

## One-time setup (agent)

1. Render the prompt: `python -X utf8 scripts/render_agent_prompt.py` → `system-prompt.md` here.
2. ElevenLabs dashboard → Agents → New agent "Caller":
   - System prompt: paste `system-prompt.md`. It uses three dynamic variables —
     `call_id`, `consultancy_name`, `student_profile` — the backend supplies them per call.
     Set placeholder defaults in the agent's Dynamic Variables panel for text testing.
   - First message: leave EMPTY / set to blank — the consultancy answers the phone first.
     If the platform requires one, use: "Assalam o alaikum, am I through to {{consultancy_name}}?"
   - LLM: default; temperature low.
   - Tools → Add tool → Webhook, FOUR times: `tool.log_quote.json`, `tool.end_call_outcome.json`,
     `tool.get_leverage.json`, `tool.red_flag_check.json` — replacing `{PUBLIC_BASE_URL}` with
     the ngrok URL. (ngrok URL changes on restart — update all four tools when it does.)
     NOTE: the ElevenLabs "JSON Mode" editor uses its own internal schema — use the **Form**
     view instead and transcribe name/description/URL/parameters from each `tool.*.json`
     (each JSON property = one Body parameter; its `required` array marks which fields to tick;
     Value type = LLM Prompt).
3. Put the agent id into `.env` as `ELEVENLABS_AGENT_ID_CALLER`.

## One-time setup (Twilio → ElevenLabs)

1. Twilio trial: buy/claim a number, verify your own phone (trial accounts can ONLY call
   verified numbers — which is exactly what we want; we never cold-dial a real consultancy).
2. ElevenLabs dashboard → Phone Numbers → Import number (Twilio) → paste Twilio SID + auth
   token + the Twilio number. Copy the resulting phone number id.
3. `.env`: `ELEVENLABS_PHONE_NUMBER_ID`, `TWILIO_*`, and `VERIFIED_TARGET_NUMBER` (your phone,
   E.164 format e.g. +923xxxxxxxxx). The backend always dials `VERIFIED_TARGET_NUMBER`.

## Text-mode test loop (free — burn zero voice minutes)

1. Backend + tunnel up (`uvicorn app.main:app --port 8000`, `ngrok http 8000`); profile frozen.
2. Create a dry-run call so the webhooks have a call to attach to — board page → pick a persona
   → tick "dry run" → Start, or:
   `curl -X POST localhost:8000/api/calls -H "Content-Type: application/json" -d "{\"consultancy_name\":\"SkyBridge Consultants\",\"persona_id\":\"commission_pusher\",\"dry_run\":true}"`
   Note the returned call_id and set it as the `call_id` dynamic variable in the test panel
   (with dry runs the webhook also falls back to the latest open call if the id is a placeholder).
3. Open the Caller's Test/chat tab. In a second tab open the matching persona agent's chat.
   Relay messages between the two by copy-paste — Caller line → persona chat, persona reply →
   Caller chat. This is the agent-vs-persona exit test without spending a voice minute.
4. Watch the board (localhost:3000/board): rows must appear as figures are stated, revised
   prices must show the strikethrough, and the call must end with a structured outcome badge.
5. A run FAILS if: any stated figure never reaches the board; a figure is logged that was never
   stated (invention); the Caller accepts a package price; it skips a sweep; or the call ends
   without `end_call_outcome`.

## The negotiation test loop (Phase 5 exit criterion)

Needs at least one PRIOR call ended as `quote` in the DB — that is the leverage. Then run the
relay loop above against a second persona (Adeel the commission-pusher folds his £350 service
fee to £200 against a named competitor quote; Maryam waives her £100 file-opening charge when
the below-market-floor flag is voiced):

1. After both sweeps the Caller must call `get_leverage` and deliver the "say" line with the
   EXACT amounts returned — nothing else.
2. When a deposit is stated for a named university, the Caller must `red_flag_check` it in the
   same turn and, if flagged, voice the benchmark line ("The published deposit for X is £N…").
3. Any price the persona moves must be re-logged with `is_revised` — the board shows the
   strikethrough and the report page (localhost:3000/report) shows "negotiated −£N".
4. PASS = one price/term measurably changes because of tool-fetched leverage, and the report
   ranks the calls with the red flags annotated.
5. FAIL if: the Caller cites any figure not in a tool response (fabricated leverage — the
   cardinal sin); it does the benchmark arithmetic itself; or it haggles past one refusal.

## The real-call exit test (Phase 4 exit criterion)

Board page → pick a call-list entry or persona (leave "dry run" unticked) → Start. Your phone
rings; play the persona from its cue card (`agents/cue-cards/`). Keep the board visible —
rows appearing mid-sentence is the demo moment. One clean end-to-end run with an itemised quote
and a structured outcome = Phase 4 done.

## What "good" looks like

- Every figure logged in the same turn it is stated, exact amounts, no rounding.
- Package prices rejected every time; two sweeps always asked.
- "Are you an AI?" → the exact disclosure line, then straight back to the last question.
- No profile fact stated that isn't in the frozen profile; competitor amounts ONLY from
  `get_leverage`, benchmark figures ONLY from `red_flag_check` "say" lines.
- Exactly one end_call_outcome per call, with detail for callbacks/declines.
