"""Phases 4+5 — the Caller's and Closer's server side.

Call lifecycle:
  POST /api/calls           creates a call row and (unless dry_run) triggers an
                            ElevenLabs outbound call over the Twilio integration.
                            Requires a FROZEN profile — it is injected verbatim
                            into the call as a dynamic variable (judged rule).
  POST /tools/log_quote     mid-call webhook: one fee item per call, appears on
                            the dashboard board live while the call is running.
  POST /tools/get_leverage  mid-call webhook: the ONLY permitted source of
                            competitor comparisons — best competing offer from
                            SQLite, never fabricated (judged rule).
  POST /tools/red_flag_check
                            mid-call webhook: validates a stated figure/claim
                            against config benchmarks; flags persist to red_flags
                            and the agent says the returned line on the call.
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


def effective_rows(quotes: list[dict]) -> list[dict]:
    """Latest figure wins per line item — revisions supersede the original row.

    Line-item identity is (item, university), except 'other' where the note is
    the only thing distinguishing e.g. a courier charge from a file-opening
    charge — those stay separate rows.
    """
    collapsed: dict[tuple, dict] = {}
    for q in quotes:  # already in log order
        key = (q["item"], q["university"] or "")
        if q["item"] == "other" and not q["is_revised"]:
            key = (*key, q["note"] or "")
        elif q["item"] == "other":
            # a revision to an 'other' item targets the row it revises_from
            match = next((k for k, v in collapsed.items()
                          if k[:2] == key and v["amount"] == q.get("revised_from")), None)
            key = match or (*key, q["note"] or "")
        collapsed[key] = q
    return list(collapsed.values())


def _consultancy_total(rows: list[dict]) -> float:
    """What the consultancy itself charges — deposits pass through to universities."""
    return sum(q["amount"] for q in rows if q["item"] != "deposit")


def _fill(line: str, **values) -> str:
    for k, val in values.items():
        line = line.replace("{" + k + "}", str(val))
    return line


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


@router.post("/tools/get_leverage")
def get_leverage(body: dict) -> dict:
    """The ONLY permitted source of competitor comparisons (judged honesty rule).

    Returns the best competing itemised offer already in SQLite — lowest total
    consultancy charges from other ENDED calls, plus the lowest-deposit
    university route seen anywhere. If nothing competes yet, says so explicitly:
    the agent must then make no comparison at all.
    """
    v = get_vertical()
    levers = {l["id"]: l["line"] for l in v["negotiation"]["levers"]}
    sym = v["currency"]["symbol"]
    with get_conn() as conn:
        call = _resolve_call(conn, body.get("call_id"))
        competitors = []
        for row in conn.execute(
            # only COMPLETE quotes compete — citing a partial figure from a
            # callback/decline call as "their offer" would be dishonest leverage
            "SELECT * FROM calls WHERE id != ? AND outcome = 'quote' ORDER BY id",
            (call["id"],),
        ).fetchall():
            rows = effective_rows(_quotes_for(conn, row["id"]))
            if not rows:
                continue
            competitors.append({
                "consultancy_name": row["consultancy_name"],
                "call_id": row["id"],
                "rows": rows,
                "total": _consultancy_total(rows),
            })

    if not competitors:
        return {
            "ok": True, "has_leverage": False, "best_competitor": None, "lowest_deposit": None,
            "say": None,
            "rule": "NO competing quotes exist. Do not mention, hint at, or invent any comparison.",
        }

    best = min(competitors, key=lambda c: c["total"])
    service_fee = next((q["amount"] for q in best["rows"] if q["item"] == "service_fee"), None)
    deposits = [
        {"university": q["university"], "amount": q["amount"],
         "consultancy_name": c["consultancy_name"]}
        for c in competitors for q in c["rows"]
        if q["item"] == "deposit" and q["university"] and q["amount"] > 0
    ]
    lowest_dep = min(deposits, key=lambda d: d["amount"]) if deposits else None

    say = _fill(levers["competitor_service_fee"],
                amount=f"{service_fee if service_fee is not None else best['total']:,.0f}")
    say_deposit = None
    if lowest_dep:
        say_deposit = _fill(levers["lower_deposit_university"], currency=sym,
                            university=lowest_dep["university"],
                            amount=f"{lowest_dep['amount']:,.0f}")
    return {
        "ok": True,
        "has_leverage": True,
        "best_competitor": {
            "consultancy_name": best["consultancy_name"],
            "call_id": best["call_id"],
            "total_consultancy_charges": best["total"],
            "service_fee": service_fee,
            "itemised": [
                {"item": q["item"], "amount": q["amount"], "university": q["university"]}
                for q in best["rows"]
            ],
        },
        "lowest_deposit": lowest_dep,
        "say": say,
        "say_deposit": say_deposit,
        "rule": "Cite ONLY the amounts in this response — no other competitor figures exist.",
    }


@router.post("/tools/red_flag_check")
def red_flag_check(body: dict) -> dict:
    """Validate a stated figure/claim against config benchmarks (judged rule).

    check_type: deposit | total_charges | guarantee_claim | pressure_claim.
    A confirmed flag is persisted to red_flags (the report annotates it) and the
    response carries the exact line the agent says on the call.
    """
    v = get_vertical()
    rules = {r["id"]: r for r in v["red_flag_rules"]}
    check = body.get("check_type")

    with get_conn() as conn:
        call = _resolve_call(conn, body.get("call_id"))

        if check == "deposit":
            university, amount = body.get("university"), body.get("amount")
            if not university or not isinstance(amount, (int, float)):
                raise HTTPException(422, "deposit check needs university and amount (the quoted deposit)")
            published = next(
                (d for d in v["benchmarks"]["published_deposits"]
                 if d["university"].casefold() in university.casefold()
                 or university.casefold() in d["university"].casefold()),
                None,
            )
            if published is None:
                return {"ok": True, "flagged": False, "say": None,
                        "note": f"no published benchmark for '{university}' — cannot verify, do not challenge"}
            if amount <= published["deposit_gbp"]:
                return {"ok": True, "flagged": False, "say": None,
                        "note": f"matches or beats the published {published['university']} deposit "
                                f"of £{published['deposit_gbp']:,}"}
            rule, detail = rules["deposit_padding"], (
                f"{published['university']}: quoted £{amount:,.0f} vs published £{published['deposit_gbp']:,} "
                f"({published['source']})"
            )
            say = _fill(rule["agent_line"], university=published["university"],
                        published=f"{published['deposit_gbp']:,}", quoted=f"{amount:,.0f}")

        elif check == "total_charges":
            floor = v["benchmarks"]["market_floor_total_gbp"]
            total = _consultancy_total(effective_rows(_quotes_for(conn, call["id"])))
            if total >= floor:
                return {"ok": True, "flagged": False, "say": None,
                        "note": f"total consultancy charges £{total:,.0f} are at/above the £{floor} market floor"}
            rule = rules["below_market_floor"]
            detail = f"total consultancy charges £{total:,.0f} below the £{floor} market floor"
            say = rule["agent_line"]

        elif check in ("guarantee_claim", "pressure_claim"):
            detail = body.get("detail")
            if not detail:
                raise HTTPException(422, f"'{check}' needs detail — the claim in the consultant's own words")
            rule = rules["guaranteed_visa" if check == "guarantee_claim" else "pressure_tactics"]
            say = rule["agent_line"]

        else:
            raise HTTPException(
                422, "check_type must be one of: deposit, total_charges, guarantee_claim, pressure_claim")

        already = conn.execute(
            "SELECT id FROM red_flags WHERE call_id = ? AND rule_id = ?",
            (call["id"], rule["id"]),
        ).fetchone()
        if not already:
            conn.execute(
                "INSERT INTO red_flags (call_id, rule_id, detail) VALUES (?, ?, ?)",
                (call["id"], rule["id"], detail),
            )
    return {"ok": True, "flagged": True, "rule_id": rule["id"], "severity": rule["severity"],
            "detail": detail, "say": say,
            "note": "already flagged on this call" if already else "flag recorded — say the line above"}


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
