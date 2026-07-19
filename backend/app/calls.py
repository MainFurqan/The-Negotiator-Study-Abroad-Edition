"""Phase 4 — the Caller's server side.

Call lifecycle:
  POST /api/calls           creates a call row and (unless dry_run) triggers an
                            ElevenLabs outbound call over the Twilio integration.
                            Requires a FROZEN profile — it is injected verbatim
                            into the call as a dynamic variable (judged rule).
  POST /tools/log_quote     mid-call webhook: one fee item per call, appears on
                            the dashboard board live while the call is running.
  POST /tools/end_call_outcome
                            every call MUST end through this: quote |
                            callback_commitment | documented_decline (judged rule).
  GET  /api/calls           the live quote board's polling endpoint.
  GET  /api/callsheet       who can be called: config personas + data/call_list.json.

Safety: the dial target is ALWAYS env VERIFIED_TARGET_NUMBER (Twilio trial can
only reach verified numbers, and we never cold-dial a real consultancy from a
demo). The call-list entry supplies the NAME the agent asks for; the phone rings
on our own handset where a human plays the persona from the cue cards (Tier B).
"""
import json
import os
from pathlib import Path

import httpx
from fastapi import APIRouter, HTTPException

from .config import get_vertical
from .db import get_conn

router = APIRouter()

CALL_LIST_PATH = Path(__file__).resolve().parents[2] / "data" / "call_list.json"
ELEVENLABS_OUTBOUND_URL = "https://api.elevenlabs.io/v1/convai/twilio/outbound-call"


# ---- helpers ----------------------------------------------------------------

def _frozen_profile(conn) -> dict:
    row = conn.execute(
        "SELECT * FROM student_profile WHERE confirmed = 1 ORDER BY id DESC LIMIT 1"
    ).fetchone()
    if not row:
        raise HTTPException(409, "no frozen profile — confirm the student profile before any call")
    return json.loads(row["profile_json"])


def profile_block(p: dict) -> str:
    """Render the frozen profile as the plain-text block injected into the call.

    Only fields the student actually stated appear — verbatim values, no
    defaults, no inference. Missing fields are simply absent.
    """
    lines: list[str] = []
    if p.get("full_name"):
        city = f" ({p['home_city']})" if p.get("home_city") else ""
        lines.append(f"Student: {p['full_name']}{city}")
    q = p.get("last_qualification") or {}
    if q:
        parts = [q.get("level"), q.get("grades"), q.get("institution")]
        year = f"completed {q['year_completed']}" if q.get("year_completed") else None
        lines.append("Last qualification: " + ", ".join(str(x) for x in [*parts, year] if x))
    e = p.get("english_test") or {}
    if e:
        parts = [e.get("status"), e.get("test_type"),
                 f"overall {e['overall_score']}" if e.get("overall_score") else None,
                 e.get("test_date")]
        lines.append("English test: " + ", ".join(str(x) for x in parts if x))
    t = p.get("target") or {}
    if t:
        parts = [t.get("course"), t.get("country"), t.get("intake")]
        lines.append("Target: " + ", ".join(str(x) for x in parts if x))
        if t.get("preferred_universities"):
            lines.append("Preferred universities: " + ", ".join(t["preferred_universities"]))
    b = p.get("budget") or {}
    if b:
        parts = []
        if b.get("ceiling_per_year") is not None:
            parts.append(f"tuition ceiling {b.get('currency', '')} {b['ceiling_per_year']:,.0f}/year".strip())
        if b.get("sponsor"):
            parts.append(f"sponsor: {b['sponsor']}")
        if b.get("bank_statement_capacity_pkr") is not None:
            parts.append(f"bank statement capacity PKR {b['bank_statement_capacity_pkr']:,.0f}")
        if parts:
            lines.append("Budget: " + "; ".join(parts))
    if p.get("notes"):
        lines.append(f"Notes: {p['notes']}")
    return "\n".join(lines)


def _resolve_call(conn, call_id) -> dict:
    """Webhooks may omit call_id (text-mode tests); fall back to the latest open call."""
    if call_id is not None:
        row = conn.execute("SELECT * FROM calls WHERE id = ?", (int(call_id),)).fetchone()
        if not row:
            raise HTTPException(404, f"no call with id {call_id}")
    else:
        row = conn.execute(
            "SELECT * FROM calls WHERE outcome IS NULL ORDER BY id DESC LIMIT 1"
        ).fetchone()
        if not row:
            raise HTTPException(409, "no open call — create one via POST /api/calls first")
    return dict(row)


def _quotes_for(conn, call_id: int) -> list[dict]:
    rows = conn.execute(
        "SELECT item, amount, currency, university, is_revised, revised_from, note, logged_at"
        " FROM quotes WHERE call_id = ? ORDER BY id",
        (call_id,),
    ).fetchall()
    return [dict(r) for r in rows]


# ---- agent tool webhooks ----------------------------------------------------

@router.post("/tools/log_quote")
def log_quote(body: dict) -> dict:
    """Called by the Caller agent the moment a fee figure is stated on the call."""
    v = get_vertical()
    valid_items = v["quote_items"]
    item = body.get("item")
    if item not in valid_items:
        raise HTTPException(422, f"unknown item '{item}' — use one of {valid_items} ('other' for anything else)")
    amount = body.get("amount")
    if not isinstance(amount, (int, float)) or amount < 0:
        raise HTTPException(422, "amount must be a non-negative number — log figures exactly as stated")
    with get_conn() as conn:
        call = _resolve_call(conn, body.get("call_id"))
        if call["outcome"]:
            raise HTTPException(409, f"call {call['id']} already ended ({call['outcome']}) — no more quotes")
        conn.execute(
            "INSERT INTO quotes (call_id, item, amount, currency, university, is_revised, revised_from, note)"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                call["id"], item, float(amount),
                body.get("currency") or v["currency"]["quote_currency"],
                body.get("university"),
                1 if body.get("is_revised") else 0,
                body.get("revised_from"),
                body.get("note"),
            ),
        )
        logged = {q["item"] for q in _quotes_for(conn, call["id"])}
    return {
        "ok": True,
        "call_id": call["id"],
        "logged": item,
        "items_not_yet_logged": [i for i in valid_items if i not in logged and i != "other"],
    }


@router.post("/tools/end_call_outcome")
def end_call_outcome(body: dict) -> dict:
    """Every call ends here — one structured outcome, never 'around 50 lakh'."""
    v = get_vertical()
    outcomes = v["negotiation"]["target_outcomes"]
    outcome = body.get("outcome")
    if outcome not in outcomes:
        raise HTTPException(422, f"outcome must be one of {outcomes}")
    detail = body.get("detail")
    if outcome in ("callback_commitment", "documented_decline") and not detail:
        raise HTTPException(422, f"'{outcome}' needs a detail (named day+time, or the reason given)")
    with get_conn() as conn:
        call = _resolve_call(conn, body.get("call_id"))
        if call["outcome"]:
            raise HTTPException(409, f"call {call['id']} already ended ({call['outcome']})")
        if outcome == "quote" and not _quotes_for(conn, call["id"]):
            raise HTTPException(422, "outcome 'quote' but no items logged — log_quote each figure first")
        conn.execute(
            "UPDATE calls SET outcome = ?, outcome_detail = ? WHERE id = ?",
            (outcome, detail, call["id"]),
        )
    return {"ok": True, "call_id": call["id"], "outcome": outcome}


# ---- call orchestration -----------------------------------------------------

@router.post("/api/calls")
def create_call(body: dict) -> dict:
    """Create a call row; unless dry_run, dial out via ElevenLabs + Twilio.

    dry_run=true is the text-mode path: the row exists so the tool webhooks have
    an open call to attach to while the Caller is exercised in dashboard chat.
    """
    v = get_vertical()
    name = (body.get("consultancy_name") or "").strip()
    if not name:
        raise HTTPException(422, "consultancy_name is required")
    persona_id = body.get("persona_id")
    if persona_id and persona_id not in {p["id"] for p in v["personas"]}:
        raise HTTPException(422, f"unknown persona_id '{persona_id}'")

    with get_conn() as conn:
        profile = _frozen_profile(conn)  # gate: no calls before confirmation
        open_call = conn.execute(
            "SELECT id FROM calls WHERE outcome IS NULL ORDER BY id DESC LIMIT 1"
        ).fetchone()
        if open_call:
            raise HTTPException(409, f"call {open_call['id']} is still open — end it first (end_call_outcome)")
        cur = conn.execute(
            "INSERT INTO calls (consultancy_name, phone, persona_id) VALUES (?, ?, ?)",
            (name, body.get("phone"), persona_id),
        )
        call_id = cur.lastrowid

    if body.get("dry_run"):
        return {"ok": True, "call_id": call_id, "dialed": False,
                "note": "dry run — exercise the Caller in text mode; webhooks attach to this call"}

    api_key = os.environ.get("ELEVENLABS_API_KEY")
    agent_id = os.environ.get("ELEVENLABS_AGENT_ID_CALLER")
    phone_number_id = os.environ.get("ELEVENLABS_PHONE_NUMBER_ID")
    to_number = os.environ.get("VERIFIED_TARGET_NUMBER")  # ALWAYS ours — never cold-dial
    missing = [k for k, val in {
        "ELEVENLABS_API_KEY": api_key, "ELEVENLABS_AGENT_ID_CALLER": agent_id,
        "ELEVENLABS_PHONE_NUMBER_ID": phone_number_id, "VERIFIED_TARGET_NUMBER": to_number,
    }.items() if not val]
    if missing:
        raise HTTPException(409, f"cannot dial — set {missing} in .env (or use dry_run)")

    payload = {
        "agent_id": agent_id,
        "agent_phone_number_id": phone_number_id,
        "to_number": to_number,
        "conversation_initiation_client_data": {
            "dynamic_variables": {
                "call_id": str(call_id),
                "consultancy_name": name,
                "student_profile": profile_block(profile),
            }
        },
    }
    try:
        r = httpx.post(ELEVENLABS_OUTBOUND_URL, json=payload,
                       headers={"xi-api-key": api_key}, timeout=30)
        r.raise_for_status()
        result = r.json()
    except httpx.HTTPError as exc:
        with get_conn() as conn:  # don't leave a phantom open call blocking the next attempt
            conn.execute("UPDATE calls SET outcome = 'documented_decline', outcome_detail = ? WHERE id = ?",
                         (f"dial failed: {exc}", call_id))
        raise HTTPException(502, f"ElevenLabs outbound call failed: {exc}") from exc

    conversation_id = result.get("conversation_id")
    with get_conn() as conn:
        conn.execute("UPDATE calls SET conversation_id = ? WHERE id = ?", (conversation_id, call_id))
    return {"ok": True, "call_id": call_id, "dialed": True, "conversation_id": conversation_id}


# ---- dashboard --------------------------------------------------------------

@router.get("/api/calls")
def list_calls() -> dict:
    """Everything the live quote board needs, newest call first."""
    v = get_vertical()
    with get_conn() as conn:
        calls = [dict(r) for r in conn.execute("SELECT * FROM calls ORDER BY id DESC").fetchall()]
        for c in calls:
            c.pop("transcript_json", None)
            c["quotes"] = _quotes_for(conn, c["id"])
    return {
        "currency": {
            "symbol": v["currency"]["symbol"],
            "quote_currency": v["currency"]["quote_currency"],
            "secondary": v["currency"]["report_currency_secondary"],
            "rate": v["currency"]["gbp_to_pkr_rate"],
        },
        "quote_items": v["quote_items"],
        "calls": calls,
    }


@router.get("/api/callsheet")
def callsheet() -> dict:
    """Who can be called: simulated personas (Tier A/B) + the real OSM call list."""
    v = get_vertical()
    entries = []
    if CALL_LIST_PATH.exists():
        entries = json.loads(CALL_LIST_PATH.read_text(encoding="utf-8")).get("entries", [])
    return {
        "personas": [{"id": p["id"], "name": p["name"]} for p in v["personas"]],
        "call_list": [
            {"name": e["name"], "city": e.get("city"), "phone": e.get("phone")} for e in entries
        ],
    }
