"""Render agent system prompts from templates + the active vertical config.

The templates under agents/*/ are vertical-agnostic; every domain-specific value
is substituted from config/<VERTICAL>.json here (config-not-code, judged criterion).

Usage:  python -X utf8 scripts/render_agent_prompt.py            # all agents
        VERTICAL=au-nursing python scripts/render_agent_prompt.py
Writes  agents/<agent>/system-prompt.md next to each template.
"""
import json
import os
import sys
from pathlib import Path
from string import Template

ROOT = Path(__file__).resolve().parents[1]


def substitutions(v: dict) -> dict:
    sc = v["student_context"]
    return {
        "display_name": v["display_name"],
        "origin_country": sc["origin_country"],
        "destination_country": sc["destination_country"],
        "course": sc["course"],
        "intake": sc["intake"],
        "home_city": sc["home_city"],
        "quote_currency": v["currency"]["quote_currency"],
        "report_currency_secondary": v["currency"]["report_currency_secondary"],
        "ai_disclosure_line": v["ai_disclosure"]["line"],
    }


def main() -> int:
    vertical_id = os.environ.get("VERTICAL", "uk-llb")
    with open(ROOT / "config" / f"{vertical_id}.json", encoding="utf-8") as f:
        subs = substitutions(json.load(f))

    templates = sorted(ROOT.glob("agents/*/system-prompt.template.md"))
    if not templates:
        print("no templates found under agents/*/")
        return 1
    for tpl_path in templates:
        rendered = Template(tpl_path.read_text(encoding="utf-8")).substitute(subs)
        out_path = tpl_path.with_name("system-prompt.md")
        out_path.write_text(rendered, encoding="utf-8", newline="\n")
        print(f"rendered {out_path.relative_to(ROOT)}  (vertical: {vertical_id})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
