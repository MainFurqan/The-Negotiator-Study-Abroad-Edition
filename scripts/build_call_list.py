"""Build data/call_list.json — real education consultancies discoverable in Pakistani cities.

Source: OpenStreetMap Overpass API (free, no key). Cities come from the active vertical
config's call_list.cities. The demo dials our own verified Twilio number, but this list
proves the pipeline targets real, discoverable businesses.

Usage:  python -X utf8 scripts/build_call_list.py
Stdlib only — no extra dependencies.
"""
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OVERPASS_MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
OUT_PATH = ROOT / "data" / "call_list.json"

# Radius search around city centres — Overpass area-by-name lookups are unreliable for PK cities.
CITY_CENTRES = {
    "Lahore": (31.5497, 74.3436),
    "Faisalabad": (31.4187, 73.0791),
    "Islamabad": (33.6844, 73.0479),  # radius also catches Rawalpindi's Saddar strip
}
RADIUS_M = 25000

# Names must look like study/visa consultancies, not tax/HR/engineering consultants.
RELEVANT = re.compile(r"visa|study|abroad|overseas|immigration|education", re.IGNORECASE)
IRRELEVANT = re.compile(
    r"engineer|dental|acupunct|clinic|hospital|estate|property|passport|government|embassy|etimad|gerry"
    r"|bureau of emigration|employment corporation|application centre|application center|shuttle",
    re.IGNORECASE,
)

# Node-only keeps the query light enough for free mirrors (nwr + around consistently 504s).
QUERY_TEMPLATE = """
[out:json][timeout:60];
node(around:{radius},{lat},{lon})["name"~"visa|study abroad|overseas|immigration|education consultan",i];
out;
"""


def overpass(city: str) -> list[dict]:
    lat, lon = CITY_CENTRES[city]
    data = QUERY_TEMPLATE.format(radius=RADIUS_M, lat=lat, lon=lon).encode("utf-8")
    last_error: Exception | None = None
    for url in OVERPASS_MIRRORS:
        req = urllib.request.Request(data=data, url=url, headers={"User-Agent": "the-negotiator-hackathon/0.1"})
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                return json.load(resp).get("elements", [])
        except Exception as exc:  # noqa: BLE001 — try the next mirror
            last_error = exc
            print(f"  mirror {url.split('/')[2]} failed ({exc}), trying next ...")
            time.sleep(5)
    raise RuntimeError(f"all Overpass mirrors failed: {last_error}")


def to_entry(el: dict, city: str) -> dict | None:
    tags = el.get("tags", {})
    name = tags.get("name")
    if not name or not RELEVANT.search(name) or IRRELEVANT.search(name):
        return None
    addr = ", ".join(
        p for p in (tags.get("addr:housenumber"), tags.get("addr:street"), tags.get("addr:suburb")) if p
    )
    lat = el.get("lat") or el.get("center", {}).get("lat")
    lon = el.get("lon") or el.get("center", {}).get("lon")
    return {
        "name": name,
        "city": city,
        "phone": tags.get("phone") or tags.get("contact:phone"),
        "address": addr or None,
        "website": tags.get("website") or tags.get("contact:website"),
        "lat": lat,
        "lon": lon,
        "source": "osm-overpass",
        "osm_id": f"{el['type']}/{el['id']}",
        "demo_override_phone": None,
    }


def main() -> int:
    config_path = ROOT / "config" / "uk-llb.json"
    with open(config_path, encoding="utf-8") as f:
        call_cfg = json.load(f)["call_list"]
    cities = [c for c in call_cfg.get("cities", ["Lahore"]) if c in CITY_CENTRES]

    entries: list[dict] = []
    for city in cities:
        print(f"Querying Overpass for {city} ...")
        try:
            elements = overpass(city)
        except Exception as exc:  # noqa: BLE001 — a down mirror shouldn't kill the whole list
            print(f"  WARNING: query failed for {city}: {exc}")
            continue
        found = [e for e in (to_entry(el, city) for el in elements) if e]
        print(f"  {len(found)} relevant businesses")
        entries.extend(found)
        time.sleep(10)  # be polite to the free API — 429s otherwise

    # De-dup by name+city, phone-bearing entries first (they're callable)
    seen: set[tuple[str, str]] = set()
    unique = []
    for e in sorted(entries, key=lambda e: e["phone"] is None):
        key = (e["name"].lower(), e["city"])
        if key not in seen:
            seen.add(key)
            unique.append(e)

    OUT_PATH.parent.mkdir(exist_ok=True)
    out = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": "OpenStreetMap Overpass API",
        "search": call_cfg["search_query"],
        "cities": cities,
        "count": len(unique),
        "entries": unique,
    }
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"\nWrote {len(unique)} entries -> {OUT_PATH.relative_to(ROOT)}")
    return 0 if unique else 1


if __name__ == "__main__":
    sys.exit(main())
