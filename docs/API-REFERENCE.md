# API reference

Base URL: `http://localhost:8000` in dev, or your deployed origin (same origin as the dashboard in
production). Interactive docs: `GET /docs`.

Two audiences:
- **`/tools/*`** — called by ElevenLabs agents (webhooks). They tolerate a missing `call_id` by
  attaching to the latest open call (for text-mode testing).
- **`/api/*`** — called by the dashboard.

---

## Health

### `GET /health`
Returns `{status, vertical, display_name}`.

---

## Intake & profile

### `POST /tools/save_profile`  *(Estimator agent)*
Accepts any subset of `full_name, home_city, gender, last_qualification, english_test, target,
budget, documents_provided, notes`. Merges into the current draft.
→ `{ok, profile_id, profile_complete, still_missing[]}`. `409` if the profile is already frozen.

### `POST /api/intake/document`  *(multipart)*
Fields: `file` (PDF/PNG/JPG/WEBP), `doc_type` (`transcript|ielts_trf|bank_statement|existing_quote|other`).
Parses the document (pdfplumber for PDFs, GPT-4o-mini vision for images) and merges the evidenced
fields. → `{ok, parsed, profile, still_missing[]}`. `422` if the file can't be read.

### `GET /api/profile`
→ `{profile, confirmed}` (or `{profile: null}`) for the **current working student** — the row
flagged `active`, or (legacy dbs with no active pointer) the most recent row.

### `GET /api/profiles`  *(multi-student)*
Lists every stored student for the intake picker, newest first. Blank abandoned drafts are hidden.
→ `{profiles:[{profile_id, active, confirmed, full_name, home_city, course, level, intake,
frozen_at, created_at}]}`.

### `POST /api/profiles/{id}/activate`  *(multi-student)*
Selects a stored student as the current working profile (moves the `active` pointer only — never
edits or unfreezes any row, so the freeze/inject contract is preserved). → `{ok, profile, confirmed}`.
`404` if the id doesn't exist. The **caller then dials for this student** — its frozen profile is the
one injected into calls.

### `PUT /api/profile`
Full-profile draft save from the dashboard (replaces `profile_json`). → `{ok, profile, still_missing[]}`.
`409` if frozen.

### `POST /api/profile/confirm`
The **freeze gate**. Validates against the profile schema; on success stamps `frozen_at` and marks
`confirmed`. → `{ok, profile}`. `422 {message, errors[]}` if incomplete, `409` if already frozen.

### `POST /api/profile/reset`
Starts a fresh draft (old rows kept). → `{ok}`.

### `GET /api/estimator/session?gender=`
Returns the Estimator voice for the given gender (or the saved profile's gender if omitted).
Rule: `female → female voice`, everything else → male voice. →
`{ok, requested_gender, resolved_gender, voice:{voice_id, label, description, configured}, agent_id,
overrides}`. `overrides` is the ready-to-use ElevenLabs `conversation_config_override` (present only
when the voice id is set in env).

---

## Calls (Caller agent + board)

### `POST /tools/log_quote`  *(agent)*
Body: `item` (one of config `quote_items`, `other` for anything else), `amount` (≥0), optional
`currency, university, is_revised, revised_from, note, call_id`. → `{ok, call_id, logged,
items_not_yet_logged[]}`. `422` on unknown item/amount, `409` if the call already ended.

### `POST /tools/get_leverage`  *(agent)*
The **only** source of competitor comparisons. Reads the best competing itemised offer from other
**ended `quote`** calls. → `{ok, has_leverage, best_competitor, lowest_deposit, say, say_deposit,
rule}`. When nothing competes, `has_leverage:false` and the agent must make no comparison.

### `POST /tools/red_flag_check`  *(agent)*
Body: `check_type` = `deposit | total_charges | guarantee_claim | pressure_claim` (+ `university`,
`amount`, or `detail` depending on type). Validates against config benchmarks; persists confirmed
flags. → `{ok, flagged, rule_id?, severity?, detail?, say?, note}`.

### `POST /tools/end_call_outcome`  *(agent)*
Body: `outcome` = `quote | callback_commitment | documented_decline`; `detail` required for the
latter two; `quote` requires at least one logged item. → `{ok, call_id, outcome}`.

### `GET /api/agencies`
The fixed agencies the caller page offers in its dropdown (config-driven, `config/uk-llb.json`
→ `agencies.list`). → `{agencies:[{id, display_name, tagline, country, initials, accent,
persona_id, persona_name}]}`. Each agency maps to one persona; the number dialed is **always**
`VERIFIED_TARGET_NUMBER` regardless of the agency shown.

### `POST /api/calls`
Create a call. **Preferred body:** `agency_id` (one of `GET /api/agencies`) — the agency supplies
the display name + mapped persona. **Legacy body:** `consultancy_name` (+ optional `persona_id`).
Optional `phone, dry_run`. Requires a **frozen** profile for the active student and no other open
call. With `dry_run:true` it just creates the row (text-mode). Otherwise it dials
`VERIFIED_TARGET_NUMBER` via ElevenLabs+Twilio, injecting the frozen profile as a dynamic variable.
→ `{ok, call_id, dialed, conversation_id?}`. `422` on unknown `agency_id`. `409` if no frozen
profile / a call is open / dialing env missing.

### `POST /api/calls/{id}/cancel`
Close an open call from the dashboard (declined / no-answer / hang-up). Marks it
`documented_decline` with an optional `{reason}` — preserving the structured-outcome invariant — so
the user can pick another agency and try again. Already-ended calls are left untouched.
→ `{ok, call_id, outcome, detail?}`.

### `GET /api/calls`
Live board payload: `{currency:{symbol, quote_currency, secondary, rate, rate_live, rate_source,
rate_fetched_at}, quote_items[], calls[]}`. Each call includes `quotes[]` and `red_flags[]`.

### `GET /api/callsheet`
`{personas:[{id,name}], call_list:[{name,city,phone}]}` — legacy list (personas + OSM call list).
The caller page now uses `GET /api/agencies`; this endpoint remains for reference/text-mode tooling.

---

## Report

### `GET /api/report`
Deterministic ranked comparison: `{vertical, currency, ranked[], others[], recommendation}`. Ranked
entries carry `rank, consultancy_total, consultancy_total_secondary, items[], deposits[], savings,
red_flags[], conversation_id`.

### `GET /api/report/pdf`
The same report as a downloadable, branded PDF (`application/pdf`, `Content-Disposition:
attachment`). Includes the frozen student profile, rankings, itemised fees, savings, red flags, the
FX line, and a timestamp.

---

## Environment variables

Copy `.env.example` → `.env`. Everything is optional for local dev except where a feature needs it.

### ElevenLabs
| Var | Used for |
|---|---|
| `ELEVENLABS_API_KEY` | Triggering outbound calls |
| `ELEVENLABS_AGENT_ID_ESTIMATOR` | Estimator agent id (returned by `/api/estimator/session`) |
| `ELEVENLABS_AGENT_ID_CALLER` | Caller agent id (outbound calls) |
| `ELEVENLABS_AGENT_ID_PERSONA_COMMISSION` / `_FEEHIDER` / `_STONEWALL` | Persona agent ids |
| `ELEVENLABS_PHONE_NUMBER_ID` | Imported Twilio number id (`phnum_…`) |
| `ELEVENLABS_VOICE_ID_FEMALE` / `_MALE` | Estimator voice per gender (female students → female voice, else male). Blank = keep the agent's configured voice. |

### Twilio
| Var | Used for |
|---|---|
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | Twilio account/number |
| `VERIFIED_TARGET_NUMBER` | The number every demo call dials (trial can only reach verified numbers). |

### OpenAI
| Var | Used for |
|---|---|
| `OPENAI_API_KEY` | Document parsing (`docparse.py`) only. |

### FX (live GBP→PKR)
| Var | Effect |
|---|---|
| `FX_DISABLE=1` | Force the static config rate (offline). |
| `FX_TTL_SECONDS` | Cache duration for a fetched rate (default 21600 = 6h). |
| `FX_TIMEOUT` | Provider timeout seconds (default 6). |
| `FX_PROVIDER_URL` | Override provider (default `https://open.er-api.com/v6/latest/{base}`). |
| `NEGOTIATOR_FX_CACHE` | On-disk cache path (default `backend/fx_cache.json`; set to a volume path in prod). |

### App / deployment
| Var | Effect |
|---|---|
| `VERTICAL` | Active config id (default `uk-llb`). |
| `NEGOTIATOR_DB` | SQLite path (default `backend/negotiator.db`; a volume path in prod). |
| `ALLOWED_ORIGINS` | CORS origins, comma-separated (default `http://localhost:3000`). |
| `NEXT_PUBLIC_API_BASE` | **Frontend build-time** backend base URL. Empty = same-origin. Baked at build. |
| `PUBLIC_BASE_URL` | Public backend URL for reference/webhooks. |
| `GOOGLE_PLACES_API_KEY` | Optional; call-list generation (OSM used if empty). |
