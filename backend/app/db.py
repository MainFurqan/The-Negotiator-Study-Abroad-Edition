"""SQLite storage. One db file, plain sqlite3 — no ORM needed at this scale."""
import os
import sqlite3
from pathlib import Path

# NEGOTIATOR_DB lets deployments point at a mounted volume; default = local dev file
DB_PATH = Path(os.environ.get("NEGOTIATOR_DB") or Path(__file__).resolve().parents[1] / "negotiator.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS student_profile (
    id INTEGER PRIMARY KEY,
    profile_json TEXT NOT NULL,        -- frozen StudentProfile, reused verbatim
    confirmed INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 0,  -- 1 = the current working student (multi-student)
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS calls (
    id INTEGER PRIMARY KEY,
    consultancy_name TEXT NOT NULL,
    phone TEXT,
    persona_id TEXT,                   -- null for real external calls
    conversation_id TEXT,              -- ElevenLabs conversation id
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    outcome TEXT,                      -- quote | callback_commitment | documented_decline
    outcome_detail TEXT,
    transcript_json TEXT
);

CREATE TABLE IF NOT EXISTS quotes (
    id INTEGER PRIMARY KEY,
    call_id INTEGER NOT NULL REFERENCES calls(id),
    item TEXT NOT NULL,                -- one of config quote_items
    amount REAL NOT NULL,
    currency TEXT NOT NULL,
    university TEXT,
    is_revised INTEGER NOT NULL DEFAULT 0,  -- 1 = price moved during negotiation
    revised_from REAL,                 -- original amount before the negotiation moved it
    note TEXT,
    logged_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS red_flags (
    id INTEGER PRIMARY KEY,
    call_id INTEGER NOT NULL REFERENCES calls(id),
    rule_id TEXT NOT NULL,
    detail TEXT,
    flagged_at TEXT NOT NULL DEFAULT (datetime('now'))
);
"""


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    with get_conn() as conn:
        conn.executescript(SCHEMA)
        # dbs created before phase-4 lack the revised_from column
        try:
            conn.execute("ALTER TABLE quotes ADD COLUMN revised_from REAL")
        except sqlite3.OperationalError:
            pass
        # multi-student (UX restructure): `active` marks which stored profile is the
        # current working student. At most one row is active=1; legacy dbs have none,
        # in which case "current" falls back to the most recent row (back-compat).
        try:
            conn.execute("ALTER TABLE student_profile ADD COLUMN active INTEGER NOT NULL DEFAULT 0")
        except sqlite3.OperationalError:
            pass
