"""Loads the JSON content files in this directory into the Supabase knowledge_base table.

Run manually, once (or whenever content changes):
    SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=... python seed.py

Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the environment only — never hardcode
the service_role key in this file, it bypasses Row Level Security. stdlib-only (urllib), no
new backend dependency for what's a one-off content-loading script, not part of the running app.
"""

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

CONTENT_FILES = [
    "western_astrology/planets.json",
    "western_astrology/signs.json",
    "western_astrology/houses.json",
    "western_astrology/aspects.json",
    "western_astrology/retrogrades.json",
    "numerology/numbers.json",
]


def load_entries() -> list[dict]:
    base = Path(__file__).parent
    entries = []
    for relative_path in CONTENT_FILES:
        path = base / relative_path
        with open(path, encoding="utf-8") as f:
            file_entries = json.load(f)
        entries.extend(file_entries)
    # PostgREST's bulk insert requires every object in the batch to share the same
    # keys — astrology entries don't author a context_notes field (numerology-only),
    # so normalize it to explicit null rather than adding boilerplate to every
    # astrology JSON entry.
    for entry in entries:
        entry.setdefault("context_notes", None)
    return entries


def upsert(supabase_url: str, service_role_key: str, entries: list[dict]) -> None:
    url = f"{supabase_url}/rest/v1/knowledge_base?on_conflict=system,category,topic"
    body = json.dumps(entries).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
    )
    try:
        with urllib.request.urlopen(req) as resp:
            print(f"Upserted {len(entries)} entries — status {resp.status}")
    except urllib.error.HTTPError as e:
        print(f"Failed: {e.code} {e.reason}\n{e.read().decode('utf-8')}", file=sys.stderr)
        raise


def main() -> None:
    supabase_url = os.environ.get("SUPABASE_URL")
    service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not service_role_key:
        print("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.", file=sys.stderr)
        sys.exit(1)

    entries = load_entries()
    print(f"Loaded {len(entries)} entries from {len(CONTENT_FILES)} files.")
    upsert(supabase_url, service_role_key, entries)


if __name__ == "__main__":
    main()
