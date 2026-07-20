# Development guide

## Prerequisites

- **Python 3.12+** (3.14 works). On Windows, run scripts that print non-ASCII with `python -X utf8`.
- **Node 20+** (Node 22/24 fine) and npm.
- A `.env` file (copy from `.env.example`). Most features degrade gracefully without keys — see
  [API-REFERENCE.md](API-REFERENCE.md#environment-variables).

## Install & run

### Backend

```bash
python -m venv .venv
# Windows
.venv/Scripts/pip install -r backend/requirements.txt
# macOS/Linux
# source .venv/bin/activate && pip install -r backend/requirements.txt

cd backend
# On Windows, run WITHOUT --reload (orphaned-worker port bug, see note below):
python -X utf8 -m uvicorn app.main:app --port 8000
```

- Health check: `GET http://localhost:8000/health`.
- Interactive API docs (FastAPI): `http://localhost:8000/docs`.
- The SQLite file is created automatically at `backend/negotiator.db` (override with `NEGOTIATOR_DB`).

> **Windows note:** `uvicorn --reload` spawns a watcher + worker. If you `Ctrl-C` and a worker is
> orphaned, port 8000 may stay bound. Kill the leftover `python.exe` (the one whose command line
> contains `multiprocessing-fork`) or just run without `--reload`.

### Frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000
```

Other scripts: `npm run build` (production build), `npm start` (serve the build), `npm run lint`.

### One-command preview

`.claude/launch.json` defines `frontend` and `backend` launch configs for tools that read it.

## Environment variables

Every variable is documented in [API-REFERENCE.md](API-REFERENCE.md#environment-variables). The ones
you'll touch most in dev:

| Var | Effect |
|---|---|
| `NEXT_PUBLIC_API_BASE` | Frontend → backend base URL. Empty = same-origin (prod). Default dev = `http://localhost:8000`. |
| `VERTICAL` | Which `config/<id>.json` is active. Default `uk-llb`. |
| `OPENAI_API_KEY` | Needed only when parsing uploaded documents. |
| `FX_DISABLE=1` | Force the static config FX rate (offline demos). |

## Scripts (`scripts/`)

| Script | Purpose |
|---|---|
| `validate_config.py` | Validate every `config/*.json` and the example instances against the schemas. **Must stay green.** `python -X utf8 scripts/validate_config.py` |
| `build_call_list.py` | Build `data/call_list.json` from OpenStreetMap Overpass (free, keyless). |
| `render_agent_prompt.py` | Render an agent's `system-prompt.md` from its `.template.md` + the active config. Run after editing config or a template. |
| `test_closer.py` | 17-check evaluation of the leverage/red-flag/report logic. Backs up and restores the DB. `python -X utf8 scripts/test_closer.py` |

## Backend developer guide

- **Add a config-driven fact** (a benchmark, lever, persona): edit `config/uk-llb.json`, then run
  `validate_config.py`. No Python change needed for domain data.
- **Add an endpoint:** put it in the relevant router (`intake.py`, `calls.py`, `report.py`) so it's
  auto-mounted by `main.py`. Read config via `get_vertical()`; read the DB via `get_conn()`.
- **Touch OpenAI only in `docparse.py`**; touch the FX provider only in `fx.py`. Keep providers
  isolated and swappable.
- **Never break honesty invariants:** competitor comparisons come only from `get_leverage`; red
  flags only from `config` benchmarks; every call ends via `end_call_outcome`.
- After changing leverage/red-flag/report code, run `test_closer.py`.

## Frontend developer guide

The frontend is a customised Next.js 16 build. Before writing framework-level code, skim the
bundled docs at `frontend/node_modules/next/dist/docs/` (App Router conventions apply, but confirm
specifics there).

**Design tokens.** Never hardcode hex colours in components. Use the Tailwind utilities backed by
CSS variables: `bg-background/surface/surface-2/surface-3`, `text-foreground/muted/muted-2`,
`text-brand/brand-2`, `border-border/border-strong`, and the semantic
`success/warning/danger/info` (each has a `-soft` background variant). Add a new token by defining
it in both themes in `globals.css` and mapping it in the `@theme inline` block.

**Primitives** live in `components/ui/` — reuse `Button`, `Card`/`MotionCard`, `Badge`/`LiveBadge`,
`Input`/`Select`/`Textarea`/`Field`, `CountUp`/`Skeleton`. Compose pages inside
`PageContainer`/`PageHeader`.

**Add a page:**
1. Create `app/<route>/page.tsx` (add `"use client"` if it uses state/effects/polling).
2. Fetch through `apiFetch` from `lib/api.ts`; reuse the shared types there.
3. Navigation for the three flow pages lives in the gated `components/shell/flow-bar.tsx` (add the
   step + gating rule in `lib/flow.ts`), **not** the navbar — `top-nav.tsx` is brand + theme only.
4. Add an `error.tsx` in the route folder for a friendly boundary (see `app/board/error.tsx`).

**The gated flow bar.** `lib/flow.ts` derives each step's state (`locked | available | current |
complete`) from real backend signals: Caller unlocks on `GET /api/profile.confirmed`, Report unlocks
on an ended call in `GET /api/calls`. `components/shell/flow-bar.tsx` renders it below the navbar on
`/intake`, `/board`, `/report` only (never `/`), polls those endpoints, and shows a tooltip when a
locked step is clicked. To change a gate, edit `isUnlocked`/`isComplete`/`lockReason` in `lib/flow.ts`.

**Add a component:** put shared UI in `components/ui/`, feature UI under
`components/<feature>/`. Keep pure logic (derivations, validation) in `lib/` so components stay thin.

**Quality gate before commit / build:**

```bash
cd frontend
npx tsc --noEmit     # types
npm run lint         # eslint (Next config)
npm run build        # full production build
```

All three must pass — the Docker image runs `npm run build`.

## Working with the agents

Voice minutes are scarce. Iterate agent prompts in **text mode** in the ElevenLabs console first.
Prompts are generated: edit the `.template.md`, then run `render_agent_prompt.py`, then paste the
rendered `system-prompt.md` into the console. See [INTEGRATIONS.md](INTEGRATIONS.md).

## Common tasks

- **Add / switch students:** `/intake` shows the student picker. "Add new student" calls
  `POST /api/profile/reset` (a fresh active draft); selecting a card calls
  `POST /api/profiles/{id}/activate`. The active student is the one the caller dials for and the
  report covers. `GET /api/profiles` lists all of them.
- **Change the agency names / behaviour:** edit `config/uk-llb.json` → `agencies.list`
  (`display_name`, `tagline`, `accent`) and, for what each asks, the mapped persona's `quote_sheet`.
  Re-run `validate_config.py`. See [CONFIGURATION.md](CONFIGURATION.md#agencies-the-caller-dropdown).
- **Reset the demo:** `POST /api/profile/reset` (starts a fresh active draft; old rows are kept). To
  wipe calls, delete rows from `calls`/`quotes`/`red_flags` or delete `backend/negotiator.db`.
- **Clear a stuck open call:** `POST /api/calls/{id}/cancel` (or use the caller page's "Hang up").
- **Change the vertical:** set `VERTICAL=au-nursing` and restart the backend.
- **Refresh the FX cache:** delete `backend/fx_cache.json`, or wait for the TTL (`FX_TTL_SECONDS`).
