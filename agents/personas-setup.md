# Persona agents — ElevenLabs setup + exit test (Phase 3)

Three simulated counsellor agents (Tier A counterparty market). They have **no tools and no
webhooks** — they only talk. All iteration in **TEXT MODE**; do not assign voice time now
(voices get picked in Phase 7 before golden recordings).

> Credit note: STRATEGY.md allows a second free ElevenLabs account for personas if the main
> account's credits run low. The personas are independent of the Estimator/Caller, so either
> account works.

## Create each agent

For each of the three, in ElevenLabs → Agents → New agent:

| Agent name | System prompt file | First message |
|---|---|---|
| Persona — Adeel (Commission Pusher) | `agents/persona-commission-pusher/system-prompt.md` | "SkyBridge Consultants, Adeel speaking! UK, Australia, Canada — how can I help?" |
| Persona — Maryam (Fee-Hider) | `agents/persona-fee-hider/system-prompt.md` | "Crescent Education, Maryam here. How may I help you today?" |
| Persona — Rana sahib (Stonewaller) | `agents/persona-stonewaller/system-prompt.md` | "Al-Falah. Haan, boliye." |

Settings per agent:
- **LLM:** GPT-4o Mini (same as Estimator).
- **System prompt:** paste the rendered `system-prompt.md` (regenerate any time with
  `python -X utf8 scripts/render_agent_prompt.py` — persona data lives in `config/uk-llb.json`).
- **First message:** from the table above.
- **Tools:** none. **Knowledge base:** none.
- Save the agent IDs into `.env` (`ELEVENLABS_AGENT_ID_PERSONA_COMMISSION` / `_FEEHIDER` /
  `_STONEWALL`).
- Publish, then test in the text chat panel.

## Exit test (Phase 3 exit criterion)

One text-mode conversation per persona where **you play the caller** and extraction is
*hard but succeeds*. Use the negotiation levers from `config/uk-llb.json` — especially the
itemisation ask ("I need each fee itemised — service, application, deposit, visa") and a
competitor cite ("another consultancy quoted a £2,000-deposit university and no service fee").

A run PASSES when:

**Adeel (Commission Pusher)**
- Deflects itemisation twice ("package deal") and itemises only on your third ask.
- Pushes Hull/UWE even after you name Manchester.
- Quotes £8,000 for Manchester's deposit; retreats to £6,000 only when you cite the published figure twice.
- Drops £350 → £200 only after you name a competitor figure — not for "that's expensive".

**Maryam (Fee-Hider)**
- Opens with "counselling is completely free".
- File charge (£100) appears only on your first "any other charges?" sweep; courier (£45) +
  embassy facilitation (£150) only on the second sweep.
- Waives the £100 only when you connect "free" to hidden fees.

**Rana sahib (Stonewaller)**
- Zero numbers until: office-visit deflection → robot question → your honest AI answer →
  your competitor cite. Then £250 flat / £2,000 QMUL deposit — or a callback with a named
  day+time if you only satisfied one trigger part.
- Bonus run: dodge the robot question and confirm he declines and ends the call.

A run FAILS (persona folded — the #1 weak-submission trap) if any figure appears one press
early, or a concession fires without its exact trigger. If a persona folds, tighten its
template's resistance wording, re-render, re-paste, re-test.

Save each passing transcript to `data/transcripts/persona-<id>-textrun.md` (copy-paste from the
chat panel; no special format needed).

## Tier B reminder

The same three characters exist as one-page human cue cards in `agents/cue-cards/` — those are
for YOU to role-play on real Twilio calls in Phase 4. Keep agent behavior and cue cards in sync:
both are generated from / grounded in the same `personas[].quote_sheet` blocks in the config.
