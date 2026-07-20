# Troubleshooting, FAQ & maintenance

## Common errors

### Frontend shows "Backend unreachable" / no data
The backend isn't running or the base URL is wrong. Check `GET http://localhost:8000/health`. In dev,
`NEXT_PUBLIC_API_BASE` defaults to `http://localhost:8000`; in prod it's empty (same origin). Remember
it's **baked at build time** — changing it needs a rebuild.

### The Caller (or Report) step in the flow bar is locked
By design. **Caller** unlocks only when the *active* student's profile is frozen; **Report** unlocks
only after a call has ended. Freeze a profile on `/intake` (or complete a call) to unlock. Clicking a
locked step shows a tooltip explaining what's required. Gating lives in `frontend/lib/flow.ts`.

### `POST /api/calls` → 409 "no frozen profile for the active student"
The **currently selected** student isn't frozen. On `/intake` either freeze the active student, or
pick a different (frozen) student from the picker — the caller dials for whichever student is active,
never a different one.

### `POST /api/calls` → 409 "call … is still open"
Only one call may be open at a time. Close it with `POST /api/calls/{id}/cancel` (the caller page's
"Hang up" button does this), or end it via the agent's `end_call_outcome`. As a last resort delete
the row: `DELETE FROM calls WHERE id=<id>` plus its `quotes`/`red_flags`.

### `POST /api/calls` → 422 "unknown agency_id"
The `agency_id` isn't in `config/uk-llb.json` → `agencies.list`. Use one from `GET /api/agencies`.

### The caller page shows "Dialing isn't configured — running a simulated call"
A dialing env var is missing, so the page fell back to a dry-run (by design, so the demo never
crashes). Set the four dial vars (below) and turn the "Dry run" toggle off for a real call.

### `POST /api/calls` → 409 "cannot dial — set [...]"
A dialing env var is missing. Set `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID_CALLER`,
`ELEVENLABS_PHONE_NUMBER_ID`, `VERIFIED_TARGET_NUMBER` — or use `dry_run:true` for text mode.

### Document upload → 422 "PDF has no text layer"
It's a scanned PDF. Upload a photo/screenshot instead (images go through GPT-4o-mini vision). Also
ensure `OPENAI_API_KEY` is set.

### Estimator voice indicator says "set the voice id in .env"
`ELEVENLABS_VOICE_ID_FEMALE` / `_MALE` are blank. The mapping still works; set the ids (and allow the
override on the agent) to make it audible. See [INTEGRATIONS.md](INTEGRATIONS.md#gender-based-estimator-voice).

### Report/board rate shows a fallback source
The FX provider was unreachable and the cached/config rate was used. Normal and harmless. Force a
refresh by deleting `backend/fx_cache.json`, or set `FX_DISABLE=1` to always use the config rate.

### `validate_config.py` fails
Your edit to `config/*.json` broke the schema. The output names the exact path and message. Fix and
re-run until green — this gate must pass.

### Windows: port 8000 stays bound after Ctrl-C
`uvicorn --reload` leaves an orphaned worker. Kill the `python.exe` whose command line contains
`multiprocessing-fork`, or run uvicorn without `--reload`.

### `next build` fails on lint/types
Run `npx tsc --noEmit` and `npm run lint` in `frontend/` to see the errors. Common culprits: a raw
`any` (type it), or a Framer `ease` tuple (annotate as `[number, number, number, number]`).

### Docker: frontend build OOMs
Use `t3.small` or larger — `t2/t3.micro` can run out of memory during the Next build.

### Caddy can't get a certificate
Ports 80 **and** 443 must be open to the world in the security group, and `DOMAIN` must actually
resolve to the instance IP (with `sslip.io` that's automatic once the Elastic IP is associated).

## FAQ

**Does the agent ever make up numbers or competitor offers?**
No. Leverage comes only from `get_leverage` (ended `quote` calls in the DB); red flags only from
`config` benchmarks; the profile is frozen and injected verbatim.

**Why does every call dial my own number?**
Safety and Twilio trial limits. The demo never cold-dials a real consultancy; a human plays the
persona from the cue cards on the verified handset.

**How do I change market/university/fees?**
Edit `config/uk-llb.json` (or a new vertical file) and re-run `validate_config.py`. No code change.

**Can I run fully offline?**
Mostly. Set `FX_DISABLE=1` (uses the config rate) and skip document uploads (which need OpenAI). The
dashboard, board, report, and PDF all work without network.

**Is the transcript on `/board` the real ElevenLabs transcript?**
It's a deterministic reconstruction from the logged quotes/outcomes (labelled as such in the UI) — it
reads like the live negotiation without needing an extra transcript API.

**Where's the data stored?**
One SQLite file (`backend/negotiator.db`, or `/data/negotiator.db` in Docker). The whole profile is a
JSON blob, so shape changes don't need migrations.

## Maintenance

- **Back up the DB** regularly (see [DEPLOYMENT.md](DEPLOYMENT.md#database--persistence)).
- **Update benchmarks before a demo** — the `source` URLs in `config` show where each figure came
  from; refresh deposits/visa/IHS/IELTS and bump `gbp_to_pkr_rate` as the fallback.
- **Rotate secrets** in `.env` if exposed; they're never committed (`.env` is git-ignored).
- **Re-render agent prompts** after any config/template change and re-publish the agents.
- **Keep the quality gate green:** `validate_config.py`, `test_closer.py`, and in `frontend/`
  `tsc --noEmit` + `npm run lint` + `npm run build`.
- **Dependencies:** backend in `backend/requirements.txt`, frontend in `frontend/package.json`
  (lockfile committed; Docker uses `npm ci`).
