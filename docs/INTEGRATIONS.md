# Integrations

> New here? Follow **[SETUP-GUIDE.md](SETUP-GUIDE.md)** first — it walks a fresh clone through every
> ElevenLabs and Twilio step end-to-end. This page is the concise reference.

## ElevenLabs Agents

Five agents live in the ElevenLabs Conversational-AI console; their prompts and tool configs are in
`agents/`. Prompts are **generated** — edit the `.template.md`, run
`python -X utf8 scripts/render_agent_prompt.py`, then paste the rendered `system-prompt.md` into the
console and publish.

| Agent | Folder | Tools it calls |
|---|---|---|
| Estimator | `agents/estimator/` | `save_profile` |
| Caller | `agents/caller/` | `log_quote`, `get_leverage`, `red_flag_check`, `end_call_outcome` |
| Persona ×3 | `agents/persona-*/` | none (they *are* the counterparty) |

### Wiring a tool webhook

Each tool is an HTTP webhook pointing at your backend. Reference JSON configs are in the agent
folders (`agents/caller/tool.*.json`, `agents/estimator/tool.save_profile.json`).

1. In the agent → **Tools** → add a **Webhook** tool (use the **Form** view, not raw JSON).
2. **URL:** `https://<your-host>/tools/<name>` (e.g. `…/tools/log_quote`). In production this is the
   Caddy origin; in local iteration a tunnel URL.
3. **Method:** `POST`. Body: the parameters listed in the tool's JSON config.
4. Save and **publish** the agent.

If your public URL changes (e.g. a new tunnel), update every tool URL and re-publish. This is the
pain a permanent deployment removes — see [DEPLOYMENT.md](DEPLOYMENT.md).

### Text-mode iteration (save your voice minutes)

Exercise agents in the console's **text** chat first. The `/tools/*` webhooks accept a missing
`call_id` and attach to the latest open call, so you can:

1. `POST /api/calls` with `{"dry_run": true, "persona_id": "…", "consultancy_name": "…"}` to open a call.
2. Drive the Caller in text mode; watch rows appear on `/board`.
3. End with `end_call_outcome`.

## Twilio

The demo **always dials `VERIFIED_TARGET_NUMBER`** — never a real consultancy. On a Twilio trial you
can only call verified numbers, and a human plays the persona from the cue cards on the other end.

1. Buy/verify a number in Twilio; verify your own handset as a caller ID (`VERIFIED_TARGET_NUMBER`).
2. In ElevenLabs → **Phone Numbers** → import the Twilio number. Copy the resulting id
   (`phnum_…`) into `ELEVENLABS_PHONE_NUMBER_ID`.
3. Put `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `VERIFIED_TARGET_NUMBER`,
   `ELEVENLABS_API_KEY`, and `ELEVENLABS_AGENT_ID_CALLER` in `.env`.

`POST /api/calls` (without `dry_run`) then triggers an outbound call, injecting the frozen profile as
the `student_profile` dynamic variable. If any dialing env var is missing the endpoint returns a
`409` telling you which — and the caller page falls back to a simulated dry-run so a demo never
hard-crashes.

### The three fixed agencies (caller dropdown)

The caller page lists three agencies (`GET /api/agencies`, defined in `config/uk-llb.json` →
`agencies.list`). Selecting one and calling sends `agency_id` to `POST /api/calls`; the backend uses
the agency's `display_name` as the call identity and its mapped `persona_id` for the simulated
counterparty. **The dialed number is always `VERIFIED_TARGET_NUMBER`, whatever agency is shown** —
the agency changes only branding and which persona a human plays from the cue cards. The names are
realistic but fictional demo brands, not real companies. A declined/unanswered call is closed with
`POST /api/calls/{id}/cancel` so the operator can try another agency.

## Gender-based Estimator voice

**Goal:** a female student hears a female-voiced Estimator; everyone else hears the male voice.

**How it works.** Gender is captured on `/intake` *before* the voice agent starts. The backend maps
it to a voice (`GET /api/estimator/session`), returning the ElevenLabs
`conversation_config_override` you pass when starting the Estimator conversation. Labels come from
`config`; real voice ids come from `ELEVENLABS_VOICE_ID_FEMALE` / `_MALE`.

**To make it audible:**
1. Pick two voices in ElevenLabs; put their ids in `.env`.
2. In the Estimator agent → **Security**, allow the `tts.voice_id` override.
3. Whatever starts the Estimator conversation (an embedded widget or a launcher) passes the
   `overrides` object from `/api/estimator/session?gender=<value>`.

Until the voice ids are set, `/intake` still shows which voice *would* be used (the indicator reads
`configured: false`).

## Live FX (GBP → PKR)

`fx.py` fetches a live mid-market rate (default provider `open.er-api.com`, keyless) and caches it in
memory and on disk (`NEGOTIATOR_FX_CACHE`). If the provider is unreachable it falls back to the last
cached rate, then to the `gbp_to_pkr_rate` in config. It **never raises**, so the report/board always
render. The report and board expose `rate_live`, `rate_source`, and `rate_fetched_at` so the UI can
label the rate as live or fallback. Set `FX_DISABLE=1` for a fully offline demo.

## OpenAI (document parsing)

Confined to `docparse.py`. PDFs with a text layer are read by pdfplumber; images (and scanned docs)
by `gpt-4o-mini` vision. Output is a *partial* profile containing only fields the document evidences —
never guesses. Needs `OPENAI_API_KEY` only when a document is actually uploaded.
