# Accounts & Keys Checklist (Phase 0 — do these yourself, ~30 min)

Fill each value into `.env` (copy from `.env.example`). Never paste keys into chat.

## 1. ElevenLabs — DONE ✓
- [x] Account created, 10,000 free credits.
- [ ] Copy API key → `ELEVENLABS_API_KEY`.
- Rule: agent iteration in **text mode only**; voice minutes are reserved for golden calls.

## 2. Twilio (free trial)
- [ ] Sign up at twilio.com → get trial number (US number is fine).
- [ ] **Verify your own Pakistani mobile number** (Console → Phone Numbers → Verified Caller IDs). Trial accounts can ONLY call verified numbers — this is our Tier B counterparty phone.
- [ ] Copy `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`; put your mobile in `VERIFIED_TARGET_NUMBER`.
- Note: trial calls play a short "trial account" preamble — acceptable for demo; mention in README.

## 3. OpenAI — credits available ✓
- [ ] Create API key at platform.openai.com → `OPENAI_API_KEY`.
- We use `gpt-4o-mini` (vision) for document parsing only. Cost is negligible.

## 4. ngrok (free)
- [ ] Sign up at ngrok.com, install, run `ngrok config add-authtoken <token>`.
- [ ] Test: `ngrok http 8000` → copy https URL → `PUBLIC_BASE_URL`.
- Note: free-tier URL changes each restart → re-paste into ElevenLabs tool definitions each session.

## 5. Google Places (optional — for real call list)
- [ ] console.cloud.google.com → enable Places API → key → `GOOGLE_PLACES_API_KEY`.
- Skip if billing setup is annoying: the Phase 1 script falls back to OSM Overpass (no key).

## 6. GitHub
- [ ] Create **private** repo `elevenlabs-the-negotiator` at github.com/new (no README/gitignore — repo already exists locally).
- [ ] Then run:
  ```
  git remote add origin https://github.com/<username>/elevenlabs-the-negotiator.git
  git push -u origin main
  ```
