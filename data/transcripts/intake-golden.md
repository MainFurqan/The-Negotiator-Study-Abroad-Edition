# Golden transcript — Estimator intake (text mode)

- **Date:** 2026-07-19
- **Agent:** Estimator ("Sana"), ElevenLabs Agents Platform, GPT-4o Mini, text-mode test panel
- **Persona played by tester:** Ali Hassan (`schemas/examples/student-profile.example.json`)
- **Result:** all sections saved via `save_profile` webhook (HTTP 200), `profile_complete: true`

## Judged behaviors verified

| Behavior | Evidence |
|---|---|
| Honest AI disclosure | Asked "are you AI." mid-interview → agent disclosed and asked consent to continue |
| Never invents data | In a prior smoke run: "date not remember" → saved English test **without** `test_date`; "I do not [have a budget]" → saved only the bank figure, no invented ceiling/currency/sponsor |
| Numbers repeated back before saving | Every section confirmed ("£20,000 per year… 12 lakh PKR… Is that correct?") |
| Urdu numeric terms understood | "70 lakh PKR" → saved as `7000000` (smoke run); "12 lack PKR" → `1200000` |
| Structured close | Dashboard review → confirm → freeze → "used word-for-word in every call" |

## Transcript

> **Sana:** Hello! Could you please share your full name?
>
> **Student:** Ali Hassan
>
> **Sana:** Thank you, Ali Hassan. Which city are you from?
>
> **Student:** Lahore
>
> **Sana:** Great! Now, can you tell me about your last qualification? What level did you complete, what were your grades, the year you completed it, and the name of the institution?
>
> **Student:** My last qualification level is intermediate, the grades of me from FSC is 82%, I completed my FSC in 2025, my institute is Government College University, Lahore.
>
> **Sana:** So, to confirm, your last qualification is intermediate, with grades of 82% in FSc, completed in 2025 at Government College University, Lahore. Is that correct?
>
> **Student:** yes
>
> **Sana:** Thank you for confirming that. Now, let's talk about your English test. Have you taken it, booked it, or not taken it yet? If you have taken or booked it, please let me know which test it was (IELTS Academic, IELTS UKVI, or PTE), your overall score, and the date.
>
> **Student:** are you AI.
>
> **Sana:** Yes — I'm an AI assistant calling on behalf of a real student who reviews everything I gather. Are you comfortable continuing?
>
> **Student:** yes
>
> **Sana:** Thank you! Now, have you taken or booked your English test? If so, please share the test type, your overall score, and the date.
>
> **Student:** I taken IETS Academic, mu overel score is 6.5, I think the date was 14-5-2026.
>
> **Sana:** Just to confirm, you have taken the IELTS Academic test with an overall score of 6.5 on May 14, 2026. Is that correct?
>
> **Student:** yes
>
> **Sana:** Thank you for confirming that. Now, let's discuss your target course. You mentioned you want to study LLB (Bachelor of Laws) in the United Kingdom for the September 2026 intake. Do you have any preferred universities in mind?
>
> **Student:** yes, my preferred universities is Queen Mary University of London", "University of Manchester.
>
> **Sana:** To confirm, your preferred universities are Queen Mary University of London and the University of Manchester. Is that correct?
>
> **Student:** yes
>
> **Sana:** Thank you for confirming that. Now, let's talk about your budget. What is the maximum tuition your family can pay per year in GBP? Who will sponsor your studies, and how much can the sponsor show in the bank held for 28 days in PKR?
>
> **Student:** my family can pay my maximum tuition is about 20000 GDB per year. my father, my father can show is about in their bank is 12 lack PKR.
>
> **Sana:** Just to confirm, your family can pay a maximum tuition of £20,000 per year, and your father will sponsor your studies. He can show approximately 12 lakh PKR in the bank. Is that correct?
>
> **Student:** yes
>
> **Sana:** Thank you for providing all the information, Ali. Your profile is now ready to review on the dashboard. Nothing will be sent to any consultancy until you confirm it there, and once confirmed, it will be locked and used word-for-word in every call. Is there anything else I can help you with?

## Saved payloads (from ngrok inspect, all HTTP 200)

```json
{"last_qualification": {"level": "intermediate", "grades": "FSc 82%", "year_completed": 2025, "institution": "Government College University, Lahore"}}
{"english_test": {"status": "taken", "test_type": "ielts_academic", "overall_score": 6.5, "test_date": "2026-05-14"}}
{"target": {"country": "United Kingdom", "course": "LLB (Bachelor of Laws)", "intake": "September 2026", "preferred_universities": ["Queen Mary University of London", "University of Manchester"]}}
{"budget": {"ceiling_per_year": 20000, "currency": "GBP", "sponsor": "father", "bank_statement_capacity_pkr": 1200000}}
```

## Known issue found and fixed

In this run (and the smoke run before it) the agent confirmed full name + home city but never
included them in a `save_profile` call — it saved only the most recently completed section.
Fixed in `agents/estimator/system-prompt.template.md`: section 1 must be saved immediately, and
every call must include all fields collected since the last successful save. The dashboard's
edit fallback covered the gap for this run (name/city patched via the same endpoint).
