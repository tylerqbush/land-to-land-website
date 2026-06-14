#!/usr/bin/env python3
"""CLI entry point for the DDR pipeline. Used by GitHub Actions workflow_dispatch."""
import argparse
import os
import sys

from dotenv import load_dotenv

load_dotenv()

sys.path.insert(0, os.path.dirname(__file__))

from airtable import find_or_create_record
from pipeline import run_pipeline


def main():
    parser = argparse.ArgumentParser(description="Run the DDR pipeline for a parcel.")
    parser.add_argument("--apn", required=True)
    parser.add_argument("--county", required=True)
    parser.add_argument("--state", required=True)
    parser.add_argument("--owner-name", default="")
    parser.add_argument("--size", default="")
    parser.add_argument("--subdivision", default="")
    args = parser.parse_args()

    print(f"Finding or creating Airtable record for APN {args.apn} ({args.county}, {args.state})...")
    record_id, record_url = find_or_create_record(
        apn=args.apn,
        county=args.county,
        state=args.state,
        owner_name=args.owner_name,
        size=args.size,
        subdivision=args.subdivision,
    )
    print(f"Record: {record_url}")
    print(f"Running pipeline for record {record_id}...")
    run_pipeline(record_id, test_mode=False)
    print("Done.")


if __name__ == "__main__":
    main()
