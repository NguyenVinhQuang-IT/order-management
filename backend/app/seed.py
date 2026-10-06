from .auth import hash_password
from .constants import PROCESSES, SEED_EMPLOYEES
from .db import dump_data, get_db, parse_data, transaction

_PASSWORD_HASHES = {}


def _hash(password):
    hashed = _PASSWORD_HASHES.get(password)
    if hashed is None:
        hashed = hash_password(password)
        _PASSWORD_HASHES[password] = hashed
    return hashed


def _table_count(db, table):
    row = db.execute(f"SELECT COUNT(*) AS n FROM {table}").fetchone()
    return int(row["n"] if row else 0)


def seed_if_empty():
    with transaction() as db:
        _seed(db)


def _seed(db):
    if _table_count(db, "process") == 0:
        db.executemany(
            "INSERT INTO process (id, name) VALUES (?, ?)",
            [(pid, name) for pid, _slug, name in PROCESSES],
        )

    existing_ids = {
        row["id"]: row["name"]
        for row in db.execute("SELECT id, name FROM process")
    }
    existing_config = {
        row["process_id"]: row
        for row in db.execute(
            "SELECT id, process_id, data FROM config WHERE process_id IS NOT NULL"
        )
    }
    slug_by_id = {pid: slug for pid, slug, _name in PROCESSES}
    slug_by_name = {name: slug for _pid, slug, name in PROCESSES}
    for pid, name in existing_ids.items():
        slug = slug_by_id.get(pid) or slug_by_name.get(name)
        if not slug:
            continue
        payload = parse_data(existing_config[pid]["data"]) if pid in existing_config else {}
        if payload.get("slug"):
            continue
        payload["slug"] = slug
        if pid in existing_config:
            db.execute(
                "UPDATE config SET data = ? WHERE id = ?",
                (dump_data(payload), existing_config[pid]["id"]),
            )
        else:
            db.execute(
                "INSERT INTO config (process_id, data) VALUES (?, ?)",
                (pid, dump_data(payload)),
            )

    if _table_count(db, "emp") == 0:
        db.executemany(
            "INSERT INTO emp (id, name) VALUES (?, ?)",
            [(emp_id, name) for emp_id, name, _role, _password in SEED_EMPLOYEES],
        )
        system = db.execute(
            "SELECT id, data FROM config WHERE process_id IS NULL ORDER BY id LIMIT 1"
        ).fetchone()
        payload = parse_data(system["data"] if system else None)
        auth = payload.get("auth") if isinstance(payload.get("auth"), dict) else {}
        for emp_id, _name, role, password in SEED_EMPLOYEES:
            auth[str(emp_id)] = {
                "password_hash": _hash(password),
                "role": role,
            }
        payload["auth"] = auth
        if system:
            db.execute(
                "UPDATE config SET data = ? WHERE id = ?",
                (dump_data(payload), system["id"]),
            )
        else:
            db.execute(
                "INSERT INTO config (process_id, data) VALUES (?, ?)",
                (None, dump_data(payload)),
            )
