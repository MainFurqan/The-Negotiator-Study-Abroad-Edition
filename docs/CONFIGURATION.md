# Configuration guide — "vertical as config, not code"

The entire domain — which market, which universities, which fees, which negotiation lines, which
counsellor personas, which currency, which Estimator voices — lives in one JSON file:
`config/<vertical>.json`. `uk-llb.json` is active by default. Set `VERTICAL=<id>` to switch.

Every config is validated against `schemas/vertical-config.schema.json` by
`scripts/validate_config.py`, which **must stay green**:

```bash
python -X utf8 scripts/validate_config.py
```

## Top-level keys

| Key | Meaning |
|---|---|
| `vertical_id` | Slug matching the filename (`^[a-z0-9-]+$`). |
| `display_name` | Human title shown in the report header. |
| `student_context` | Origin/destination country, course, intake, home city — defaults for the vertical. |
| `currency` | Quote + secondary currency, symbol, fallback FX rate, note. |
| `benchmarks` | The published figures red flags are checked against. |
| `quote_items` | Allowed fee line-item ids (validated on every `log_quote`). |
| `red_flag_rules` | The checks the agent can raise, with severities and the exact line to say. |
| `negotiation` | Leverage lines, honesty constraints, allowed outcomes. |
| `ai_disclosure` | Policy + line for "are you an AI?". |
| `estimator` | Estimator voice labels per gender (see below). |
| `personas` | The simulated counsellors, each with a quote sheet. |
| `agencies` | *(optional)* The fixed agencies the caller page offers; each maps to a persona (see below). |
| `call_list` | Search parameters for `build_call_list.py`. |

## `currency`

```json
"currency": {
  "quote_currency": "GBP", "symbol": "£",
  "report_currency_secondary": "PKR",
  "gbp_to_pkr_rate": 374.0,
  "rate_note": "…fallback if the FX API is unavailable"
}
```

`gbp_to_pkr_rate` is the **fallback**. At runtime `fx.py` fetches a live rate; the config value is
used only when the provider and the on-disk cache are both unavailable (or `FX_DISABLE=1`).

## `benchmarks`

Free-form but must include `published_deposits[]` (each: `university`, `deposit_gbp`, `note`,
`source`). Also holds `market_floor_total_gbp`, visa/IHS/IELTS figures, tuition ranges, etc. These
are what `red_flag_check` compares against — **the only source of truth for "too high / too low"**.
Keep the `source` URLs accurate; the report cites them.

## `red_flag_rules`

Each rule: `id`, `description`, `check` (documentation string), `severity` (`low|medium|high`),
`agent_line` (with `{placeholders}` the backend fills). The four wired checks are `deposit_padding`,
`below_market_floor`, `guaranteed_visa`, `pressure_tactics` (mapped from the `check_type` sent to
`red_flag_check`).

## `negotiation`

- `levers[]` — `id` + `line` (the exact sentence the agent says). `get_leverage` fills
  `competitor_service_fee` and `lower_deposit_university` with real amounts from the DB.
- `honesty_constraints[]` — the rules the prompt bakes in.
- `target_outcomes` — must be exactly `["quote","callback_commitment","documented_decline"]`.

## `estimator` (voice selection)

```json
"estimator": {
  "voices": {
    "female": { "label": "Sana",  "description": "Warm female counsellor voice" },
    "male":   { "label": "Bilal", "description": "Calm male counsellor voice" }
  }
}
```

Labels/descriptions are display-only. The real ElevenLabs voice ids come from
`ELEVENLABS_VOICE_ID_FEMALE` / `ELEVENLABS_VOICE_ID_MALE` (kept out of git). A female student hears
the female voice; every other value (male / unspecified / unset) hears the male voice. Exposed via
`GET /api/estimator/session`. See [INTEGRATIONS.md](INTEGRATIONS.md#gender-based-estimator-voice).

## `personas`

Each persona: `id`, `name`, `style`, `resistance`, `concession_rule`, and a `quote_sheet` (universities
pushed + a `fees[]` list with `item`, `amount_gbp`, `when`, `note`). The persona prompts in
`agents/persona-*/` and cue cards in `agents/cue-cards/` are rendered from these. This is what makes
the simulated calls reproducible and the red-flag "bait" deliberate.

## `agencies` (the caller dropdown)

```json
"agencies": {
  "list": [
    { "id": "britannia", "display_name": "Britannia Study Abroad",
      "tagline": "UK admissions & visa consultancy · Lahore · Karachi · Islamabad",
      "country": "United Kingdom", "initials": "BS", "accent": "#6366f1",
      "persona_id": "commission_pusher" }
    // … albion → fee_hider, crownbridge → stonewaller
  ]
}
```

The caller page (`/board`) offers these three agencies in a dropdown (`GET /api/agencies`). Each
agency is the **display identity** for a call and maps (`persona_id`) to one of the `personas` above,
so the questions asked and figures captured stay config-driven and reproducible.

- The names are **realistic but fictional** demo brands — they are *not* real companies, and the
  persona behaviours (deposit-padding, fee-hiding, stonewalling) are simulated test scenarios, not
  claims about any real firm.
- **Safety invariant:** whatever agency is shown, the backend always dials `VERIFIED_TARGET_NUMBER`.
  The agency only changes branding + the mapped persona, never the dial target.
- To rename an agency or change what it asks: edit `display_name`/`tagline`/`accent` here and the
  mapped persona's `quote_sheet`. Each `id` must be `^[a-z0-9_-]+$`; each `persona_id` must exist in
  `personas`. Required fields: `id`, `display_name`, `persona_id`. Then re-run
  `validate_config.py`.

The block is optional — a config without `agencies` simply offers no agency dropdown.

## Adding a new vertical

1. Copy `uk-llb.json` → `config/<new-id>.json`; edit every domain value.
2. `python -X utf8 scripts/validate_config.py` until green.
3. Re-render the agent prompts: `python -X utf8 scripts/render_agent_prompt.py` (per agent).
4. Run the backend with `VERTICAL=<new-id>`.

Because no domain fact lives in Python or the frontend, that's the whole change.
