"""Live FX rates with caching and graceful degradation.

The report and the live board convert GBP → PKR. Rather than trust a single
hardcoded number, we fetch a live mid-market rate and cache it. The contract is
strict: this module NEVER raises. If the network is down or the provider is
unreachable, it falls back to the last cached rate, and finally to the static
`gbp_to_pkr_rate` in the vertical config. Report generation must always succeed.

Provider: open.er-api.com (keyless, no signup). Override with FX_PROVIDER_URL.
Set FX_DISABLE=1 to force the config fallback (e.g. offline demos).
"""
from __future__ import annotations

import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx

_CACHE_PATH = Path(
    os.environ.get("NEGOTIATOR_FX_CACHE")
    or Path(__file__).resolve().parents[1] / "fx_cache.json"
)
_TTL_SECONDS = int(os.environ.get("FX_TTL_SECONDS", "21600"))  # 6 hours
_TIMEOUT = float(os.environ.get("FX_TIMEOUT", "6"))
_PROVIDER_URL = os.environ.get("FX_PROVIDER_URL", "https://open.er-api.com/v6/latest/{base}")

# process-local memo so a burst of report/board requests hits the network once
_mem: dict[str, dict] = {}


def _iso(epoch: float) -> str:
    return datetime.fromtimestamp(epoch, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _load_disk() -> dict:
    try:
        return json.loads(_CACHE_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _save_disk(data: dict) -> None:
    try:
        _CACHE_PATH.write_text(json.dumps(data), encoding="utf-8")
    except Exception:
        pass


def _result(rate: float, *, live: bool, source: str, epoch: float | None) -> dict:
    return {
        "rate": round(float(rate), 4),
        "live": live,
        "source": source,
        "fetched_at": _iso(epoch) if epoch else None,
    }


def get_rate(base: str, quote: str, fallback: float) -> dict:
    """Return {rate, live, source, fetched_at} for base→quote. Never raises."""
    key = f"{base}_{quote}"
    now = time.time()

    if os.environ.get("FX_DISABLE") == "1":
        return _result(fallback, live=False, source="config-fallback", epoch=None)

    # 1) fresh in-memory value
    cached = _mem.get(key)
    if cached and now - cached["epoch"] < _TTL_SECONDS:
        return _result(cached["rate"], live=True, source=cached["source"], epoch=cached["epoch"])

    # 2) fetch live
    try:
        r = httpx.get(_PROVIDER_URL.format(base=base), timeout=_TIMEOUT)
        r.raise_for_status()
        payload = r.json()
        rate = (payload.get("rates") or payload.get("conversion_rates") or {}).get(quote)
        if not rate:
            raise ValueError(f"{quote} not in provider response")
        entry = {"rate": float(rate), "epoch": now, "source": "open.er-api.com"}
        _mem[key] = entry
        disk = _load_disk()
        disk[key] = entry
        _save_disk(disk)
        return _result(entry["rate"], live=True, source=entry["source"], epoch=now)
    except Exception:
        pass

    # 3) last cached value on disk (stale but real)
    disk = _load_disk()
    if key in disk:
        entry = disk[key]
        _mem[key] = entry
        return _result(entry["rate"], live=False, source=f"{entry['source']} (cached)", epoch=entry["epoch"])

    # 4) config fallback
    return _result(fallback, live=False, source="config-fallback", epoch=None)
