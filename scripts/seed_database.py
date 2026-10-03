"""Create tables, insert students and the SYNTHETIC activity timeline.
Uses Tiger Data / PostgreSQL when DATABASE_URL (or TIGER_DATABASE_URL) is set and reachable, else local SQLite.
   python scripts/seed_database.py"""
import _path  # noqa: F401
from backend import database
from backend.services import tiger_service

if __name__ == "__main__":
    info = database.status()
    print(f"Database: {info['backend']} ({'Tiger Data / PostgreSQL' if info['mode']=='tiger' else 'Demo mode — local data'})"
          + (f" | TimescaleDB hypertable: {info['timescale']}" if info['mode'] == 'tiger' else ""))
    if info["error"]:
        print("Note:", info["error"])
    result = tiger_service.seed_all(verbose=True)
    print("Seeded:", result)
