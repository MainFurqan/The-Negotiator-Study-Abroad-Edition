"""Validate vertical configs and example instances against the JSON schemas.

Usage:  python -X utf8 scripts/validate_config.py
Exit 0 = everything valid (Phase 1 exit criterion). Any failure prints the path and exits 1.

Also enforces the cross-file rule JSON Schema can't express alone:
every ItemisedQuote item name must be a member of the active config's quote_items.
"""
import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[1]
SCHEMAS = ROOT / "schemas"
CONFIGS = ROOT / "config"


def load(path: Path) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def check(instance_path: Path, schema_path: Path) -> bool:
    validator = Draft202012Validator(load(schema_path))
    errors = sorted(validator.iter_errors(load(instance_path)), key=lambda e: list(e.path))
    rel = instance_path.relative_to(ROOT)
    if errors:
        print(f"FAIL  {rel}  (against {schema_path.name})")
        for e in errors:
            loc = "/".join(str(p) for p in e.path) or "<root>"
            print(f"      {loc}: {e.message}")
        return False
    print(f"ok    {rel}  (against {schema_path.name})")
    return True


def check_quote_items_membership(quote_path: Path, config_path: Path) -> bool:
    allowed = set(load(config_path)["quote_items"])
    items = {i["item"] for i in load(quote_path)["items"]}
    unknown = items - allowed
    if unknown:
        print(f"FAIL  {quote_path.relative_to(ROOT)}: items not in {config_path.name} quote_items: {sorted(unknown)}")
        return False
    print(f"ok    {quote_path.relative_to(ROOT)}: all items are members of {config_path.name} quote_items")
    return True


def main() -> int:
    ok = True
    for cfg in sorted(CONFIGS.glob("*.json")):
        ok &= check(cfg, SCHEMAS / "vertical-config.schema.json")
    ok &= check(SCHEMAS / "examples" / "student-profile.example.json", SCHEMAS / "student-profile.schema.json")
    ok &= check(SCHEMAS / "examples" / "itemised-quote.example.json", SCHEMAS / "itemised-quote.schema.json")
    ok &= check_quote_items_membership(
        SCHEMAS / "examples" / "itemised-quote.example.json", CONFIGS / "uk-llb.json"
    )
    print("\nAll valid." if ok else "\nValidation FAILED.")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
