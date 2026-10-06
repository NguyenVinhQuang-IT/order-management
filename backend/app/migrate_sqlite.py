import json
import sqlite3
from pathlib import Path

from psycopg.types.json import Jsonb

TABLES = ("process", "emp", "config", "oders")
IDENTITY_TABLES = ("config", "oders")
BATCH = 2000


def sqlite_path(root=None):
    base = Path(root) if root else Path(__file__).resolve().parent.parent
    return base / "data" / "order-management.db"


def _as_jsonb(raw):
    if raw is None or raw == "":
        return Jsonb({})
    if isinstance(raw, dict):
        return Jsonb(raw)
    try:
        value = json.loads(raw)
    except (TypeError, json.JSONDecodeError):
        return Jsonb({})
    return Jsonb(value if isinstance(value, dict) else {})


def migrate_sqlite_if_needed(db, root=None):
    path = sqlite_path(root)
    if not path.is_file():
        return 0
    pg_count = db.execute("SELECT COUNT(*) AS n FROM oders").fetchone()
    if int(pg_count["n"] if pg_count else 0) > 0:
        return 0

    src = sqlite3.connect(path)
    src.row_factory = sqlite3.Row
    try:
        sqlite_count = src.execute("SELECT COUNT(*) AS n FROM oders").fetchone()
        if not sqlite_count or int(sqlite_count[0] or 0) == 0:
            return 0
        db.execute("BEGIN")
        try:
            db.execute("TRUNCATE oders, config, emp, process RESTART IDENTITY CASCADE")
            copied = 0
            for table in TABLES:
                rows = src.execute(f"SELECT * FROM {table}").fetchall()
                if not rows:
                    continue
                columns = list(rows[0].keys())
                placeholders = ",".join("?" * len(columns))
                sql = f"INSERT INTO {table} ({','.join(columns)}) VALUES ({placeholders})"
                batch = []
                for row in rows:
                    values = []
                    for key in columns:
                        value = row[key]
                        if table == "config" and key == "data":
                            value = _as_jsonb(value)
                        values.append(value)
                    batch.append(tuple(values))
                    if len(batch) >= BATCH:
                        db.executemany(sql, batch)
                        copied += len(batch)
                        batch = []
                if batch:
                    db.executemany(sql, batch)
                    copied += len(batch)
                if table in IDENTITY_TABLES:
                    maximum = db.execute(f"SELECT MAX(id) AS m FROM {table}").fetchone()
                    seq = db.execute(
                        "SELECT pg_get_serial_sequence(%s, 'id') AS seq",
                        (table,),
                    ).fetchone()
                    if maximum and maximum["m"] and seq and seq["seq"]:
                        db.execute("SELECT setval(%s, %s)", (seq["seq"], int(maximum["m"])))
            db.execute("COMMIT")
            return copied
        except Exception:
            try:
                db.execute("ROLLBACK")
            except Exception:
                pass
            raise
    finally:
        src.close()
