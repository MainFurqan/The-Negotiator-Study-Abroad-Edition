from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_vertical
from .db import init_db

app = FastAPI(title="The Negotiator — backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    init_db()


@app.get("/health")
def health() -> dict:
    v = get_vertical()
    return {"status": "ok", "vertical": v["vertical_id"], "display_name": v["display_name"]}


# Phase 2+: routers for agent tool webhooks land here
# (save_profile, log_quote, get_leverage, red_flag_check, end_call_outcome)
