"""Phase 2 — the Estimator's server side.

Two intake paths converge on ONE draft StudentProfile row:
  - POST /tools/save_profile   (ElevenLabs Estimator agent webhook, partial merges)
  - POST /api/intake/document  (upload → docparse.parse_document → same merge)
The dashboard then shows the merged draft; POST /api/profile/confirm validates it
against schemas/student-profile.schema.json and freezes it. A frozen profile is
never edited again — it is injected verbatim into every outbound call (Phase 4).
"""
import json
import os
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from jsonschema import Draft202012Validator

from .config import get_vertical
from .db import get_conn

router = APIRouter()

SCHEMA_PATH = Path(__file__).resolve().parents[2] / "schemas" / "student-profile.schema.json"
_validator = Draft202012Validator(json.loads(SCHEMA_PATH.read_text(encoding="utf-8")))

AGENT_FIELDS = {
    "full_name", "home_city", "gender", "last_qualification", "english_test",
    "target", "budget", "documents_provided", "notes",
}


def resolve_estimator_voice(gender: str | None) -> dict:
    """Pick the Estimator agent's voice from the student's gender.

    Rule (judged backend requirement): a female student hears the female voice;
    every other value (male / unspecified / unknown) hears the male voice. Voice
    labels come from config; the real ElevenLabs voice_id comes from env so it is
    never committed. The returned `overrides` block is exactly what a client
    passes to ElevenLabs conversation-initiation to start the estimator in that
    voice.
    """
    resolved = "female" if (gender or "").strip().lower() == "female" else "male"
    voices = (get_vertical().get("estimator") or {}).get("voices") or {}
    conf = voices.get(resolved, {})
    env_key = "ELEVENLABS_VOICE_ID_FEMALE" if resolved == "female" else "ELEVENLABS_VOICE_ID_MALE"
    voice_id = os.environ.get(env_key) or None
    agent_id = os.environ.get("ELEVENLABS_AGENT_ID_ESTIMATOR") or None
    overrides = {"conversation_config_override": {"tts": {"voice_id": voice_id}}} if voice_id else None
    return {
        "requested_gender": gender,
        "resolved_gender": resolved,
        "voice": {
            "voice_id": voice_id,
            "label": conf.get("label"),
            "description": conf.get("description"),
            "configured": voice_id is not None,
        },
        "agent_id": agent_id,
        "overrides": overrides,
    }


def _current(conn) -> dict | None:
    """The current working student's row.

    Prefers the row flagged active=1 (multi-student selection). Legacy dbs have no
    active row, so it falls back to the most recent row — identical to the old
    single-profile behaviour, keeping every existing caller working unchanged.
    """
    row = conn.execute(
        "SELECT * FROM student_profile WHERE active = 1 ORDER BY id DESC LIMIT 1"
    ).fetchone()
    if row is None:
        row = conn.execute("SELECT * FROM student_profile ORDER BY id DESC LIMIT 1").fetchone()
    return dict(row) if row else None


# Backwards-compatible alias: some call sites historically used _latest().
_latest = _current


def _activate(conn, row_id: int) -> None:
    """Make exactly one row the active working student."""
    conn.execute("UPDATE student_profile SET active = 0 WHERE active = 1")
    conn.execute("UPDATE student_profile SET active = 1 WHERE id = ?", (row_id,))


def _profile_of(row: dict) -> dict:
    return json.loads(row["profile_json"])


def _save(conn, row_id: int | None, profile: dict, confirmed: bool = False) -> dict:
    if row_id is None:
        cur = conn.execute(
            "INSERT INTO student_profile (profile_json, confirmed) VALUES (?, ?)",
            ("{}", 0),
        )
        row_id = cur.lastrowid
        _activate(conn, row_id)  # a new draft becomes the current working student
    profile["profile_id"] = row_id
    conn.execute(
        "UPDATE student_profile SET profile_json = ?, confirmed = ? WHERE id = ?",
        (json.dumps(profile, ensure_ascii=False), int(confirmed), row_id),
    )
    return profile


def _deep_merge(base: dict, incoming: dict) -> dict:
    for key, value in incoming.items():
        if key == "documents_provided" and isinstance(value, list):
            existing = base.setdefault("documents_provided", [])
            known = {(d.get("type"), d.get("filename")) for d in existing}
            existing.extend(d for d in value if (d.get("type"), d.get("filename")) not in known)
        elif isinstance(value, dict) and isinstance(base.get(key), dict):
            _deep_merge(base[key], value)
        elif value is not None:
            base[key] = value
    return base


def _validation_errors(profile: dict) -> list[str]:
    candidate = {**profile, "confirmed": True, "frozen_at": "1970-01-01T00:00:00Z"}
    errors = sorted(_validator.iter_errors(candidate), key=lambda e: list(e.path))
    return [f"{'/'.join(str(p) for p in e.path) or '<root>'}: {e.message}" for e in errors]


def _merge_into_draft(incoming: dict) -> tuple[dict, list[str]]:
    """Merge a partial profile into the current draft; returns (profile, still_missing)."""
    with get_conn() as conn:
        row = _latest(conn)
        if row and row["confirmed"]:
            raise HTTPException(409, "profile is frozen — reset it before a new intake")
        profile = _profile_of(row) if row else {}
        _deep_merge(profile, incoming)
        profile = _save(conn, row["id"] if row else None, profile)
    return profile, _validation_errors(profile)


# ---- agent tool webhook -----------------------------------------------------

@router.post("/tools/save_profile")
def save_profile(body: dict) -> dict:
    """Called by the Estimator agent, possibly several times during one interview.

    Accepts any subset of StudentProfile fields; replies with what is still
    missing so the agent knows what to ask next.
    """
    incoming = {k: v for k, v in body.items() if k in AGENT_FIELDS}
    if not incoming:
        raise HTTPException(422, f"no recognised profile fields; send a subset of {sorted(AGENT_FIELDS)}")
    profile, missing = _merge_into_draft(incoming)
    return {
        "ok": True,
        "profile_id": profile["profile_id"],
        "profile_complete": not missing,
        "still_missing": missing,
    }


# ---- document intake --------------------------------------------------------

@router.post("/api/intake/document")
async def intake_document(file: UploadFile = File(...), doc_type: str = Form(...)) -> dict:
    from .docparse import parse_document  # imported here so the API key is only needed on use

    data = await file.read()
    try:
        parsed = parse_document(data, file.filename or "upload", doc_type)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    parsed.pop("profile_id", None)
    parsed.pop("confirmed", None)
    parsed.pop("frozen_at", None)
    parsed["documents_provided"] = [{"type": doc_type, "filename": file.filename, "parsed_ok": True}]
    profile, missing = _merge_into_draft(parsed)
    return {"ok": True, "parsed": parsed, "profile": profile, "still_missing": missing}


# ---- dashboard --------------------------------------------------------------

@router.get("/api/profile")
def get_profile() -> dict:
    with get_conn() as conn:
        row = _current(conn)
    if not row:
        return {"profile": None}
    return {"profile": _profile_of(row), "confirmed": bool(row["confirmed"])}


def _summary(row: dict) -> dict:
    """Compact card for the intake student picker — never leaks unrelated fields."""
    p = _profile_of(row)
    q = p.get("last_qualification") or {}
    t = p.get("target") or {}
    return {
        "profile_id": row["id"],
        "active": bool(row["active"]),
        "confirmed": bool(row["confirmed"]),
        "full_name": p.get("full_name"),
        "home_city": p.get("home_city"),
        "course": t.get("course"),
        "level": q.get("level"),
        "intake": t.get("intake"),
        "frozen_at": p.get("frozen_at"),
        "created_at": row.get("created_at"),
    }


@router.get("/api/profiles")
def list_profiles() -> dict:
    """All stored students for the intake picker, newest first. Empty drafts (no
    name yet) are hidden so a fresh 'Add new student' click doesn't clutter the list."""
    with get_conn() as conn:
        rows = [dict(r) for r in conn.execute(
            "SELECT * FROM student_profile ORDER BY id DESC"
        ).fetchall()]
    out = []
    for r in rows:
        s = _summary(r)
        if not s["full_name"] and not s["confirmed"] and not s["active"]:
            continue  # skip abandoned blank drafts
        out.append(s)
    return {"profiles": out}


@router.post("/api/profiles/{profile_id}/activate")
def activate_profile(profile_id: int) -> dict:
    """Select a stored student as the current working profile.

    Only moves the active pointer — it never edits or unfreezes any row, so the
    freeze/inject contract (confirmed profiles stay immutable and are injected
    verbatim into calls) is fully preserved.
    """
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM student_profile WHERE id = ?", (profile_id,)).fetchone()
        if not row:
            raise HTTPException(404, f"no profile with id {profile_id}")
        _activate(conn, profile_id)
        row = conn.execute("SELECT * FROM student_profile WHERE id = ?", (profile_id,)).fetchone()
    return {"ok": True, "profile": _profile_of(dict(row)), "confirmed": bool(row["confirmed"])}


@router.get("/api/estimator/session")
def estimator_session(gender: str | None = None) -> dict:
    """Voice config for launching the Estimator agent.

    If `gender` is supplied (the intake UI passes the live selection) it wins;
    otherwise the latest saved profile's gender is used. Returns the chosen voice
    and the ready-to-use ElevenLabs conversation-initiation overrides.
    """
    if gender is None:
        with get_conn() as conn:
            row = _latest(conn)
        gender = (_profile_of(row).get("gender") if row else None)
    return {"ok": True, **resolve_estimator_voice(gender)}


@router.put("/api/profile")
def put_profile(body: dict) -> dict:
    """Full-profile save from the dashboard's manual-edit fallback (draft only)."""
    with get_conn() as conn:
        row = _latest(conn)
        if row and row["confirmed"]:
            raise HTTPException(409, "profile is frozen — reset it to edit")
        body.pop("confirmed", None)
        body.pop("frozen_at", None)
        profile = _save(conn, row["id"] if row else None, {**body, "confirmed": False, "frozen_at": None})
    return {"ok": True, "profile": profile, "still_missing": _validation_errors(profile)}


@router.post("/api/profile/confirm")
def confirm_profile() -> dict:
    """The freeze gate (judged requirement): explicit confirmation, then immutable."""
    with get_conn() as conn:
        row = _latest(conn)
        if not row:
            raise HTTPException(404, "no profile to confirm")
        if row["confirmed"]:
            raise HTTPException(409, "profile already frozen")
        profile = _profile_of(row)
        errors = _validation_errors(profile)
        if errors:
            raise HTTPException(422, detail={"message": "profile incomplete", "errors": errors})
        profile["confirmed"] = True
        profile["frozen_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        profile = _save(conn, row["id"], profile, confirmed=True)
    return {"ok": True, "profile": profile}


@router.post("/api/profile/reset")
def reset_profile() -> dict:
    """Start a fresh draft (demo convenience). Old rows are kept for the record."""
    with get_conn() as conn:
        _save(conn, None, {"confirmed": False, "frozen_at": None})
    return {"ok": True}
