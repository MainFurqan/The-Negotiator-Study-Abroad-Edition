from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .calls import router as calls_router
from .config import get_vertical
from .db import init_db
from .intake import router as intake_router

app = FastAPI(title="The Negotiator — backend")
app.include_router(intake_router)
app.include_router(calls_router)

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


# Phase 5: get_leverage + red_flag_check webhooks land in calls.py
