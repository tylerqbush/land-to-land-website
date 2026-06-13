from unittest.mock import patch
from fastapi.testclient import TestClient
import main
import airtable as at

client = TestClient(main.app)


def test_generate_returns_complete_on_success():
    with patch.object(main, "find_or_create_record",
                      return_value=("recABC", "https://airtable.com/app/tbl/recABC")), \
         patch.object(main, "run_pipeline"), \
         patch.object(main.at, "get_record",
                      return_value={at.F_DRIVE_FOLDER_LINK: "https://drive.google.com/pdf"}):

        resp = client.post("/generate", data={
            "apn": "R258820",
            "county": "Klamath",
            "state": "OR",
        })

    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "complete"
    assert data["apn"] == "R258820"
    assert data["pdf_url"] == "https://drive.google.com/pdf"
    assert "recABC" in data["record_url"]


def test_generate_returns_error_when_pipeline_raises():
    with patch.object(main, "find_or_create_record",
                      return_value=("recABC", "https://airtable.com/app/tbl/recABC")), \
         patch.object(main, "run_pipeline",
                      side_effect=RuntimeError("pipeline blew up")):

        resp = client.post("/generate", data={
            "apn": "R258820",
            "county": "Klamath",
            "state": "OR",
        })

    assert resp.status_code == 500
    data = resp.json()
    assert data["status"] == "error"
    assert "pipeline blew up" in data["message"]


def test_generate_returns_error_when_airtable_raises():
    with patch.object(main, "find_or_create_record",
                      side_effect=ValueError("Airtable API key not set")):

        resp = client.post("/generate", data={
            "apn": "R258820",
            "county": "Klamath",
            "state": "OR",
        })

    assert resp.status_code == 500
    assert resp.json()["status"] == "error"


def test_health_endpoint_unaffected():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
