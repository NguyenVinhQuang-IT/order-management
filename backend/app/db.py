import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path

from flask import current_app, g

SCHEMA = """
CREATE TABLE IF NOT EXISTS config (
    id INTEGER NOT NULL
        CONSTRAINT config_pk PRIMARY KEY AUTOINCREMENT,
    process_id INTEGER,
    data TEXT
);

CREATE TABLE IF NOT EXISTS emp (
    id INTEGER NOT NULL
        CONSTRAINT emp_pk PRIMARY KEY,
    name TEXT
);

CREATE TABLE IF NOT EXISTS oders (
    id INTEGER NOT NULL
        CONSTRAINT oders_pk PRIMARY KEY AUTOINCREMENT,
    co TEXT,
    emp_id INTEGER,
    process_id INTEGER,
    note TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS process (
    id INTEGER,
    name TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS oders_co_process_uq
    ON oders (co, process_id);
CREATE UNIQUE INDEX IF NOT EXISTS process_id_uq
    ON process (id);
CREATE INDEX IF NOT EXISTS oders_emp_id_idx
    ON oders (emp_id);
CREATE INDEX IF NOT EXISTS oders_process_id_idx
    ON oders (process_id);
CREATE INDEX IF NOT EXISTS oders_created_at_idx
    ON oders (created_at);
CREATE INDEX IF NOT EXISTS config_process_id_idx
    ON config (process_id);
"""

SQLITE_BIND_LIMIT = 400


def get_db():
    if "db" not in g:
        path = Path(current_app.config["DATABASE"])
        conn = sqlite3.connect(path, timeout=5.0, detect_types=sqlite3.PARSE_DECLTYPES)
        conn.row_factory = sqlite3.Row
        conn.isolation_level = None
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("PRAGMA journal_mode = WAL")
        conn.execute("PRAGMA synchronous = NORMAL")
        conn.execute("PRAGMA temp_store = MEMORY")
        conn.execute("PRAGMA cache_size = -8000")
        conn.execute("PRAGMA mmap_size = 268435456")
        conn.execute("PRAGMA busy_timeout = 5000")
        g.db = conn
    return g.db


def close_db(_error=None):
    conn = g.pop("db", None)
    if conn is not None:
        conn.close()


def init_schema(conn=None):
    db = conn or get_db()
    db.executescript(SCHEMA)
    db.commit()


@contextmanager
def transaction():
    db = get_db()
    db.execute("BEGIN IMMEDIATE")
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise


def row_dict(row):
    if row is None:
        return None
    return dict(row)


def parse_data(raw):
    if not raw:
        return {}
    if isinstance(raw, dict):
        return raw
    try:
        value = json.loads(raw)
    except (TypeError, json.JSONDecodeError):
        return {}
    return value if isinstance(value, dict) else {}


def dump_data(value):
    return json.dumps(value if isinstance(value, dict) else {}, ensure_ascii=False, separators=(",", ":"))


def placeholders(count):
    return ",".join("?" * count)


def batched(items, size=SQLITE_BIND_LIMIT):
    seq = list(items)
    for start in range(0, len(seq), size):
        yield seq[start : start + size]
