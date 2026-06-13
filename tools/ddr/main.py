import asyncio
import os
import logging
import hmac

from fastapi import FastAPI, Request, HTTPException, BackgroundTasks, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import airtable as at
from airtable import find_or_create_record
from pipeline import run_pipeline

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="DDR Automation", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("FRONTEND_URL", "*")],
    allow_credentials=False,
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "")


def _verify_secret(provided: str) -> bool:
    if not WEBHOOK_SECRET:
        return True
    return hmac.compare_digest(WEBHOOK_SECRET, provided)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


@app.post("/generate")
async def generate(
    apn: str = Form(...),
    county: str = Form(...),
    state: str = Form(...),
    owner_name: str = Form(""),
    size: str = Form(""),
    subdivision: str = Form(""),
    drive_folder_id: str = Form(""),
):
    try:
        folder = drive_folder_id or os.environ.get("DEFAULT_DRIVE_FOLDER_ID", "")
        record_id, record_url = find_or_create_record(
            apn, county, state, owner_name, size, subdivision, folder
        )
        await asyncio.to_thread(run_pipeline, record_id, test_mode=False)
        fields = at.get_record(record_id)
        pdf_url = fields.get(at.F_DRIVE_FOLDER_LINK, "")
        return JSONResponse({"status": "complete", "pdf_url": pdf_url,
                             "record_url": record_url, "apn": apn})
    except Exception as exc:
        logger.exception("Pipeline failed for APN %s", apn)
        return JSONResponse({"status": "error", "message": str(exc)},
                            status_code=500)


@app.post("/webhook")
async def webhook(request: Request, background_tasks: BackgroundTasks):
    secret = request.headers.get("X-Webhook-Secret", "")
    if not _verify_secret(secret):
        logger.warning("Webhook received with invalid secret")
        raise HTTPException(status_code=401, detail="Invalid webhook secret")

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    record_id = (
        payload.get("record_id")
        or payload.get("recordId")
        or (payload.get("record", {}) or {}).get("id")
    )
    if not record_id:
        logger.warning("Webhook payload missing record_id: %s", payload)
        raise HTTPException(status_code=400, detail="Missing record_id in payload")

    logger.info("Webhook accepted for record %s, launching pipeline", record_id)
    background_tasks.add_task(run_pipeline, record_id, test_mode=False)
    return JSONResponse(content={"status": "accepted", "record_id": record_id})


@app.post("/test")
async def test_pipeline(background_tasks: BackgroundTasks):
    """Run pipeline with a synthetic test property (OR-Klamath-R258820)."""
    logger.info("Test pipeline triggered")
    background_tasks.add_task(run_pipeline, "TEST_RECORD", test_mode=True)
    return JSONResponse(
        content={
            "status": "test pipeline started",
            "test_property": "OR-Klamath-R258820",
            "note": "Results will be logged but NOT written back to Airtable.",
        }
    )
