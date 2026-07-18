# Estimator agent — setup & text-mode testing

The Estimator is the voice intake interviewer (Phase 2). Everything here is pasted into the
ElevenLabs dashboard once; iteration happens in TEXT mode only (voice minutes are for golden
calls and the demo).

## One-time setup

1. Render the prompt from the active vertical config:
   `python -X utf8 scripts/render_agent_prompt.py` → writes `system-prompt.md` here.
2. Start the backend + tunnel:
   - `backend\venv\Scripts\python.exe -m uvicorn app.main:app --port 8000` (from `backend/`)
   - `ngrok http 8000` → note the https URL.
3. In the ElevenLabs dashboard → Agents → New agent "Estimator":
   - System prompt: paste `system-prompt.md`.
   - First message: "Assalam-o-alaikum! I'm Sana from The Negotiator. I'll ask a few questions
     so we can get you real, comparable quotes. What's your full name?"
   - LLM: the default (GPT-4o mini class is fine — the prompt does the work). Temperature low.
   - Tools → Add tool → Webhook: copy values from `tool.save_profile.json`, replacing
     `{PUBLIC_BASE_URL}` with the ngrok URL.
4. Put the agent id into `.env` as `ELEVENLABS_AGENT_ID_ESTIMATOR`.

## Text-mode test loop (free — burn zero voice minutes)

1. Open the agent's **Test / chat** tab in the dashboard (text chat, not call).
2. Play the student (use `schemas/examples/student-profile.example.json` — Ali Hassan — as your
   script). Answer naturally; include one trap: state a number vaguely ("around twenty lakh")
   and check the agent asks to pin it down, and one refusal ("I don't know my bank capacity")
   and check the agent moves on WITHOUT inventing a value.
3. Watch the backend log — `save_profile` should fire after each section, and the agent should
   chase whatever `still_missing` returns.
4. Verify on the dashboard (localhost:3000): profile filled, then Confirm & Freeze.
5. When a run is clean, export/copy the transcript to `data/transcripts/intake-golden.md`
   (this is the Phase 2 exit artifact).

## What "good" looks like

- Every number is repeated back before saving.
- Fields the student didn't state never appear in the DB.
- Asked "are you an AI?" → the exact disclosure line from the config, then carries on.
- Ends by pointing the student to the dashboard confirmation step.
