"""Phase 5 eval — exercises get_leverage, red_flag_check and /api/report in-process.

Backs up backend/negotiator.db, runs destructive checks (closes the open call,
logs revisions, raises flags), then restores the backup — the dev DB is untouched.

Run:  python -X utf8 scripts/test_closer.py
"""
import json
import shutil
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from fastapi.testclient import TestClient  # noqa: E402
from app import db  # noqa: E402
from app.main import app  # noqa: E402

c = TestClient(app)
failures: list[str] = []


def check(name: str, cond: bool, extra: str = "") -> None:
    print(("PASS " if cond else "FAIL ") + name + (f"  {extra}" if extra else ""))
    if not cond:
        failures.append(name)


def main() -> int:
    # --- open a scratch call to negotiate on (id captured, not hardcoded) ----
    r = c.post("/api/calls", json={"consultancy_name": "Crescent Education",
                                   "persona_id": "fee_hider", "dry_run": True})
    if r.status_code == 409 and "still open" in r.text:
        # an open call already exists — use it
        with db.get_conn() as conn:
            cid = conn.execute("SELECT id FROM calls WHERE outcome IS NULL ORDER BY id DESC").fetchone()[0]
    else:
        r.raise_for_status()
        cid = r.json()["call_id"]

    # --- get_leverage: only COMPLETE quotes may compete ----------------------
    r = c.post("/tools/get_leverage", json={"call_id": cid})
    lev = r.json()
    check("leverage 200 OK", r.status_code == 200)
    if lev.get("has_leverage"):
        bc = lev["best_competitor"]
        with db.get_conn() as conn:
            outcome = conn.execute("SELECT outcome FROM calls WHERE id = ?", (bc["call_id"],)).fetchone()[0]
        check("best competitor ended as quote", outcome == "quote")
        check("say cites a tool amount", any(
            f"{v:,.0f}" in lev["say"] for v in
            [bc.get("service_fee"), bc.get("total_consultancy_charges")] if v is not None))
    else:
        check("no-leverage rule is explicit", "Do not" in lev.get("rule", ""))

    # --- red_flag_check ------------------------------------------------------
    r = c.post("/tools/red_flag_check", json={
        "call_id": cid, "check_type": "deposit", "university": "Manchester", "amount": 8000})
    f = r.json()
    check("padded Manchester deposit flagged", f.get("flagged") is True and f.get("rule_id") == "deposit_padding")
    check("say cites published 6,000", "6,000" in (f.get("say") or ""))
    r = c.post("/tools/red_flag_check", json={
        "call_id": cid, "check_type": "deposit",
        "university": "Queen Mary University of London", "amount": 2000})
    check("honest QMUL deposit not flagged", r.json().get("flagged") is False)
    r = c.post("/tools/red_flag_check", json={
        "call_id": cid, "check_type": "deposit", "university": "Hogwarts", "amount": 9999})
    check("unknown university not flagged", r.json().get("flagged") is False)
    r = c.post("/tools/red_flag_check", json={"call_id": cid, "check_type": "guarantee_claim"})
    check("guarantee without detail rejected", r.status_code == 422)
    r = c.post("/tools/red_flag_check", json={"call_id": cid, "check_type": "vibes"})
    check("unknown check_type rejected", r.status_code == 422)

    # --- negotiation movement + distinct 'other' items -----------------------
    for body in [
        {"item": "other", "amount": 100, "note": "file opening charge"},
        {"item": "other", "amount": 45, "note": "courier charge"},
        {"item": "other", "amount": 0, "is_revised": True, "revised_from": 100,
         "note": "file opening charge waived"},
        {"item": "deposit", "amount": 2000, "university": "Queen Mary University of London"},
    ]:
        c.post("/tools/log_quote", json={"call_id": cid, **body})
    r = c.post("/tools/end_call_outcome", json={"call_id": cid, "outcome": "quote"})
    check("scratch call closed as quote", r.json().get("outcome") == "quote")

    # --- report --------------------------------------------------------------
    rep = c.get("/api/report").json()
    mine = next(x for x in rep["ranked"] if x["call_id"] == cid)
    check("ranked entries have ranks", all("rank" in x for x in rep["ranked"]))
    check("'other' items stay separate rows",
          len([q for q in mine["items"] if q["item"] == "other"]) == 2)
    check("waiver collapsed to 0",
          any(q["amount"] == 0 and q["revised_from"] == 100 for q in mine["items"]))
    check("savings counted", mine["savings"] == 100.0)
    check("PKR conversion applied",
          mine["consultancy_total_secondary"] == round(mine["consultancy_total"] * rep["currency"]["rate"]))
    check("red flags annotated on report",
          any(f["rule_id"] == "deposit_padding" for f in mine["red_flags"]))
    check("recommendation is plain language", len(rep["recommendation"]) > 40)
    print("\nRECOMMENDATION:\n" + rep["recommendation"])
    return 1 if failures else 0


if __name__ == "__main__":
    backup = Path(tempfile.gettempdir()) / "negotiator.db.eval-bak"
    shutil.copy2(db.DB_PATH, backup)
    try:
        code = main()
    finally:
        shutil.copy2(backup, db.DB_PATH)
        backup.unlink()
        print("\n(dev DB restored from backup)")
    print("ALL PASS" if code == 0 else "FAILURES: " + ", ".join(failures))
    sys.exit(code)
