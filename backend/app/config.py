"""Vertical config loader. The ONLY place domain knowledge enters the system.

Swap verticals by setting VERTICAL=au-nursing (or any config/<id>.json).
"""
import json
import os
from functools import lru_cache
from pathlib import Path

CONFIG_DIR = Path(__file__).resolve().parents[2] / "config"


@lru_cache
def get_vertical() -> dict:
    vertical_id = os.environ.get("VERTICAL", "uk-llb")
    path = CONFIG_DIR / f"{vertical_id}.json"
    with open(path, encoding="utf-8") as f:
        return json.load(f)
