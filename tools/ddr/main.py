import os
import logging
import hmac

from fastapi import FastAPI, Request, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse

from pipeline import run_pipeline

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="DDR Automation", version="1.0.0")

WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "")


def _verify_secret(provided: str) -> bool:
    if not WEBHOOK_SECRET:
        return True
    return hmac.compare_digest(WEBHOOK_SECRET, provided)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


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

    logger.info("Webhook accepted for record %s — launching pipeline", record_id)
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
