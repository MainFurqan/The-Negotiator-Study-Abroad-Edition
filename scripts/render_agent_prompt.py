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


def money(v: dict, amount: float) -> str:
    sym = v["currency"].get("symbol", v["currency"]["quote_currency"] + " ")
    return f"{sym}{amount:,.0f}"


def persona_substitutions(v: dict, persona: dict) -> dict:
    """Extra placeholders available only to agents/persona-*/ templates."""
    sheet = persona.get("quote_sheet", {})
    fee_lines = []
    for f in sheet.get("fees", []):
        when = f["when"].replace("_", " ")
        note = f" — {f['note']}" if f.get("note") else ""
        fee_lines.append(f"- {f['item']}: {money(v, f['amount_gbp'])} [{when}]{note}")
    deposit_lines = [
        f"- {d['university']}: {money(v, d['deposit_gbp'])} ({d.get('note', '')})"
        for d in v["benchmarks"]["published_deposits"]
    ]
    return {
        "persona_name": persona["name"],
        "persona_style": persona["style"],
        "persona_resistance": persona["resistance"],
        "persona_concession_rule": persona["concession_rule"],
        "persona_universities_pushed": ", ".join(sheet.get("universities_pushed", [])),
        "persona_fee_sheet": "\n".join(fee_lines),
        "published_deposits": "\n".join(deposit_lines),
    }


def main() -> int:
    vertical_id = os.environ.get("VERTICAL", "uk-llb")
    with open(ROOT / "config" / f"{vertical_id}.json", encoding="utf-8") as f:
        vertical = json.load(f)
    subs = substitutions(vertical)
    personas = {p["id"]: p for p in vertical["personas"]}

    templates = sorted(ROOT.glob("agents/*/system-prompt.template.md"))
    if not templates:
        print("no templates found under agents/*/")
        return 1
    for tpl_path in templates:
        agent_dir = tpl_path.parent.name
        tpl_subs = subs
        if agent_dir.startswith("persona-"):
            persona_id = agent_dir[len("persona-"):].replace("-", "_")
            persona = personas.get(persona_id)
            if persona is None:
                print(f"skip     {agent_dir}: no persona '{persona_id}' in {vertical_id}.json")
                continue
            tpl_subs = {**subs, **persona_substitutions(vertical, persona)}
        rendered = Template(tpl_path.read_text(encoding="utf-8")).substitute(tpl_subs)
        out_path = tpl_path.with_name("system-prompt.md")
        out_path.write_text(rendered, encoding="utf-8", newline="\n")
        print(f"rendered {out_path.relative_to(ROOT)}  (vertical: {vertical_id})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
