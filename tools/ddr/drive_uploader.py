"""
Upload a PDF to Google Drive using a service account.
The service account must be granted Editor access to the target folder.
"""

import json
import logging
import os
from io import BytesIO

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaIoBaseUpload

logger = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/drive.file"]


def _get_service():
    sa_json_str = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")
    if not sa_json_str:
        raise ValueError("GOOGLE_SERVICE_ACCOUNT_JSON env var is not set")
    sa_info = json.loads(sa_json_str)
    creds = service_account.Credentials.from_service_account_info(
        sa_info, scopes=SCOPES
    )
    return build("drive", "v3", credentials=creds, cache_discovery=False)


def upload_pdf(pdf_bytes: bytes, filename: str, folder_id: str) -> str:
    """
    Upload pdf_bytes to the given Drive folder and return the shareable file URL.
    Raises on any Drive API error.
    """
    service = _get_service()

    file_metadata = {
        "name": filename,
        "mimeType": "application/pdf",
        "parents": [folder_id] if folder_id else [],
    }

    media = MediaIoBaseUpload(
        BytesIO(pdf_bytes),
        mimetype="application/pdf",
        resumable=False,
    )

    try:
        uploaded = (
            service.files()
            .create(body=file_metadata, media_body=media, fields="id, webViewLink")
            .execute()
        )
    except HttpError as exc:
        logger.error("Drive upload failed: %s", exc)
        raise

    file_id = uploaded.get("id")
    web_view_link = uploaded.get("webViewLink", f"https://drive.google.com/file/d/{file_id}/view")
    logger.info("Uploaded '%s' to Drive — %s", filename, web_view_link)

    # Make the file readable by anyone with the link
    try:
        service.permissions().create(
            fileId=file_id,
            body={"type": "anyone", "role": "reader"},
        ).execute()
    except HttpError as exc:
        logger.warning("Could not set public permission on file: %s", exc)

    return web_view_link
