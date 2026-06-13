import os
from unittest.mock import patch, MagicMock
import airtable as at


def _env():
    return {"AIRTABLE_API_KEY": "test-key"}


@patch("airtable.requests.get")
@patch("airtable.requests.post")
def test_creates_new_record_when_apn_not_found(mock_post, mock_get):
    mock_get.return_value.raise_for_status = lambda: None
    mock_get.return_value.json.return_value = {"records": []}
    mock_post.return_value.raise_for_status = lambda: None
    mock_post.return_value.json.return_value = {"id": "recNEW123"}

    with patch.dict(os.environ, _env()):
        record_id, record_url = at.find_or_create_record("APN-001", "Luna", "NM")

    assert record_id == "recNEW123"
    assert "recNEW123" in record_url
    mock_post.assert_called_once()
    fields = mock_post.call_args[1]["json"]["fields"]
    assert fields[at.F_APN] == "APN-001"
    assert fields[at.F_COUNTY] == "Luna"
    assert fields[at.F_STATE] == "NM"


@patch("airtable.requests.get")
@patch("airtable.requests.patch")
def test_patches_existing_record_when_apn_found(mock_patch, mock_get):
    mock_get.return_value.raise_for_status = lambda: None
    mock_get.return_value.json.return_value = {"records": [{"id": "recEXIST456"}]}
    mock_patch.return_value = MagicMock(ok=True)

    with patch.dict(os.environ, _env()):
        record_id, record_url = at.find_or_create_record("APN-001", "Luna", "NM")

    assert record_id == "recEXIST456"
    assert "recEXIST456" in record_url
    mock_patch.assert_called_once()


@patch("airtable.requests.get")
@patch("airtable.requests.post")
def test_converts_size_string_to_float(mock_post, mock_get):
    mock_get.return_value.raise_for_status = lambda: None
    mock_get.return_value.json.return_value = {"records": []}
    mock_post.return_value.raise_for_status = lambda: None
    mock_post.return_value.json.return_value = {"id": "recABC"}

    with patch.dict(os.environ, _env()):
        at.find_or_create_record("APN-001", "Luna", "NM", size="5.5")

    fields = mock_post.call_args[1]["json"]["fields"]
    assert fields[at.F_SIZE] == 5.5


@patch("airtable.requests.get")
@patch("airtable.requests.post")
def test_omits_size_field_when_size_empty(mock_post, mock_get):
    mock_get.return_value.raise_for_status = lambda: None
    mock_get.return_value.json.return_value = {"records": []}
    mock_post.return_value.raise_for_status = lambda: None
    mock_post.return_value.json.return_value = {"id": "recABC"}

    with patch.dict(os.environ, _env()):
        at.find_or_create_record("APN-001", "Luna", "NM", size="")

    fields = mock_post.call_args[1]["json"]["fields"]
    assert at.F_SIZE not in fields


@patch("airtable.requests.get")
@patch("airtable.requests.patch")
def test_raises_when_patch_fails(mock_patch, mock_get):
    mock_get.return_value.raise_for_status = lambda: None
    mock_get.return_value.json.return_value = {"records": [{"id": "recEXIST456"}]}
    mock_patch.return_value = MagicMock(ok=False, status_code=400)
    mock_patch.return_value.raise_for_status.side_effect = Exception("400 Bad Request")

    import pytest
    with patch.dict(os.environ, {"AIRTABLE_API_KEY": "test-key"}):
        with pytest.raises(Exception, match="400 Bad Request"):
            at.find_or_create_record("APN-001", "Luna", "NM")
