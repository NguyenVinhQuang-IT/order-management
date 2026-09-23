from datetime import datetime, timezone
from collections import defaultdict

from .auth import hash_password, verify_password
from .constants import (
    MAX_ORDERS_PER_ENTRY,
    MAX_SECONDS,
    PD_PREFIX,
    PD_PROCESS_SLUGS,
    PROCESS_BY_ID,
    PROCESS_BY_NAME,
    PROCESS_BY_SLUG,
    ROLES,
)
from .db import dump_data, get_db, parse_data, row_dict, transaction


def now_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def normalize_code(raw):
    return str(raw or "").strip().upper()


def normalize_note(raw):
    return str(raw or "").strip()


def parse_int(value, default=None):
    if value is None or value == "":
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def encode_co(code, kind):
    code = normalize_code(code)
    if get_kind(kind) == "pd":
        return f"{PD_PREFIX}{code}"
    return code


def decode_co(raw):
    text = str(raw or "")
    if text.startswith(PD_PREFIX):
        return text[len(PD_PREFIX) :], "pd"
    return text, "co"


def get_kind(kind):
    return "pd" if kind == "pd" else "co"


def parse_seconds(raw):
    if raw is None or raw == "":
        return None, ""
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return None, "Nhập số nguyên không âm."
    if value < 0:
        return None, "Nhập số nguyên không âm."
    if value > MAX_SECONDS:
        return None, f"Số giây tối đa {MAX_SECONDS}."
    return value, ""


def allows_pd(slug):
    return slug in PD_PROCESS_SLUGS


def _system_config_row(db=None):
    db = db or get_db()
    return db.execute(
        "SELECT id, process_id, data FROM config WHERE process_id IS NULL ORDER BY id LIMIT 1"
    ).fetchone()


def get_system_config(db=None):
    row = _system_config_row(db)
    return parse_data(row["data"] if row else None)


def save_system_config(payload, db=None):
    db = db or get_db()
    row = _system_config_row(db)
    data = dump_data(payload)
    if row:
        db.execute("UPDATE config SET data = ? WHERE id = ?", (data, row["id"]))
    else:
        db.execute("INSERT INTO config (process_id, data) VALUES (?, ?)", (None, data))


def get_auth_map(db=None):
    payload = get_system_config(db)
    auth = payload.get("auth")
    return auth if isinstance(auth, dict) else {}


def get_employee_auth(emp_id, db=None):
    entry = get_auth_map(db).get(str(emp_id))
    return entry if isinstance(entry, dict) else {}


def set_employee_auth(emp_id, role, password=None, db=None):
    db = db or get_db()
    payload = get_system_config(db)
    auth = payload.get("auth") if isinstance(payload.get("auth"), dict) else {}
    current = auth.get(str(emp_id)) if isinstance(auth.get(str(emp_id)), dict) else {}
    next_entry = {
        "role": role or current.get("role") or "employee",
        "password_hash": current.get("password_hash"),
    }
    if password:
        next_entry["password_hash"] = hash_password(password)
    auth[str(emp_id)] = next_entry
    payload["auth"] = auth
    save_system_config(payload, db)


def delete_employee_auth(emp_id, db=None):
    db = db or get_db()
    payload = get_system_config(db)
    auth = payload.get("auth") if isinstance(payload.get("auth"), dict) else {}
    auth.pop(str(emp_id), None)
    payload["auth"] = auth
    save_system_config(payload, db)


def get_process_config(process_id, db=None):
    db = db or get_db()
    row = db.execute(
        "SELECT id, process_id, data FROM config WHERE process_id = ? ORDER BY id LIMIT 1",
        (process_id,),
    ).fetchone()
    return row_dict(row), parse_data(row["data"] if row else None)


def save_process_config(process_id, payload, db=None):
    db = db or get_db()
    row, _current = get_process_config(process_id, db)
    data = dump_data(payload)
    if row:
        db.execute("UPDATE config SET data = ? WHERE id = ?", (data, row["id"]))
        return row["id"]
    cursor = db.execute(
        "INSERT INTO config (process_id, data) VALUES (?, ?)",
        (process_id, data),
    )
    return cursor.lastrowid


def process_slug(process_id, name=None, config=None):
    if config and config.get("slug"):
        return config["slug"]
    mapped = PROCESS_BY_ID.get(process_id)
    if mapped:
        return mapped[0]
    if name and name in PROCESS_BY_NAME:
        return PROCESS_BY_NAME[name][1]
    return None


def get_process(process_id):
    db = get_db()
    row = db.execute("SELECT id, name FROM process WHERE id = ?", (process_id,)).fetchone()
    if not row:
        return None
    _cfg_row, cfg = get_process_config(process_id, db)
    return serialize_process(row, cfg)


def find_process(process_id=None, slug=None):
    if process_id is not None:
        return get_process(parse_int(process_id))
    if slug:
        db = get_db()
        rows = db.execute("SELECT id, name FROM process").fetchall()
        for row in rows:
            _cfg_row, cfg = get_process_config(row["id"], db)
            if process_slug(row["id"], row["name"], cfg) == slug:
                return serialize_process(row, cfg)
        mapped = PROCESS_BY_SLUG.get(slug)
        if mapped:
            return get_process(mapped[0])
    return None


def serialize_process(row, cfg=None):
    cfg = cfg or {}
    slug = process_slug(row["id"], row["name"], cfg)
    seconds = cfg.get("seconds")
    return {
        "id": row["id"],
        "name": row["name"],
        "slug": slug,
        "allows_pd": allows_pd(slug),
        "seconds": seconds if isinstance(seconds, int) else None,
    }


def list_processes():
    db = get_db()
    rows = db.execute("SELECT id, name FROM process ORDER BY id").fetchall()
    items = []
    for row in rows:
        _cfg_row, cfg = get_process_config(row["id"], db)
        items.append(serialize_process(row, cfg))
    return items


def serialize_employee(row, auth=None):
    auth = auth or {}
    return {
        "id": row["id"],
        "employee_id": str(row["id"]),
        "name": row["name"],
        "role": auth.get("role") or "employee",
    }


def get_employee(emp_id):
    emp_id = parse_int(emp_id)
    if emp_id is None:
        return None
    row = get_db().execute("SELECT id, name FROM emp WHERE id = ?", (emp_id,)).fetchone()
    if not row:
        return None
    return serialize_employee(row, get_employee_auth(emp_id))


def list_employees():
    db = get_db()
    auth_map = get_auth_map(db)
    rows = db.execute("SELECT id, name FROM emp ORDER BY id").fetchall()
    return [serialize_employee(row, auth_map.get(str(row["id"]))) for row in rows]


def authenticate(employee_id, password, role):
    if role not in ROLES:
        return None, "Chọn vai trò."
    emp_id = parse_int(str(employee_id).strip())
    employee = get_employee(emp_id)
    if not employee:
        return None, "Mã nhân viên hoặc mật khẩu không đúng."
    auth = get_employee_auth(emp_id)
    if not verify_password(auth.get("password_hash"), password):
        return None, "Mã nhân viên hoặc mật khẩu không đúng."
    if employee["role"] != role:
        return None, "Tài khoản không khớp với vai trò đã chọn."
    return employee, ""


def order_seconds_value(order_id, code, cfg):
    order_seconds = cfg.get("order_seconds") if isinstance(cfg.get("order_seconds"), dict) else {}
    if str(order_id) in order_seconds:
        value = order_seconds.get(str(order_id))
        if isinstance(value, int):
            return value
    code_seconds = cfg.get("code_seconds") if isinstance(cfg.get("code_seconds"), dict) else {}
    if code in code_seconds and isinstance(code_seconds[code], int):
        return code_seconds[code]
    seconds = cfg.get("seconds")
    return seconds if isinstance(seconds, int) else None


def serialize_order(row, emp_name=None, process_name=None, cfg=None):
    cfg = cfg or {}
    code, kind = decode_co(row["co"])
    slug = process_slug(row["process_id"], process_name, cfg)
    return {
        "id": row["id"],
        "code": code,
        "co": code,
        "kind": kind,
        "type": slug,
        "process_id": row["process_id"],
        "process_name": process_name,
        "emp_id": row["emp_id"],
        "employee_id": str(row["emp_id"]) if row["emp_id"] is not None else None,
        "emp_name": emp_name,
        "note": row["note"] or "",
        "created_at": row["created_at"],
        "seconds": order_seconds_value(row["id"], code, cfg),
    }


def _process_config_map(db):
    mapping = {}
    for row in db.execute("SELECT id, process_id, data FROM config WHERE process_id IS NOT NULL"):
        mapping[row["process_id"]] = parse_data(row["data"])
    return mapping


def list_orders(user, filters=None):
    filters = filters or {}
    db = get_db()
    sql = """
        SELECT o.id, o.co, o.emp_id, o.process_id, o.note, o.created_at,
               e.name AS emp_name, p.name AS process_name
        FROM oders o
        LEFT JOIN emp e ON e.id = o.emp_id
        LEFT JOIN process p ON p.id = o.process_id
        WHERE 1 = 1
    """
    params = []
    if user["role"] != "manager":
        sql += " AND o.emp_id = ?"
        params.append(user["id"])
    elif filters.get("emp_id") not in (None, ""):
        sql += " AND o.emp_id = ?"
        params.append(parse_int(filters["emp_id"]))

    process = None
    if filters.get("process_id") not in (None, ""):
        process = get_process(parse_int(filters["process_id"]))
    elif filters.get("type"):
        process = find_process(slug=filters["type"])
    if process:
        sql += " AND o.process_id = ?"
        params.append(process["id"])

    if filters.get("kind") in ("co", "pd"):
        if filters["kind"] == "pd":
            sql += " AND o.co LIKE ?"
            params.append(f"{PD_PREFIX}%")
        else:
            sql += " AND o.co NOT LIKE ?"
            params.append(f"{PD_PREFIX}%")

    date_from = str(filters.get("from") or "").strip()
    date_to = str(filters.get("to") or "").strip()
    if date_from:
        sql += " AND substr(replace(o.created_at, ' ', 'T'), 1, 10) >= ?"
        params.append(date_from)
    if date_to:
        sql += " AND substr(replace(o.created_at, ' ', 'T'), 1, 10) <= ?"
        params.append(date_to)

    query = str(filters.get("q") or filters.get("query") or "").strip().lower()
    sql += " ORDER BY o.created_at DESC, o.id DESC"
    rows = db.execute(sql, params).fetchall()
    cfg_map = _process_config_map(db)
    items = [
        serialize_order(row, row["emp_name"], row["process_name"], cfg_map.get(row["process_id"]))
        for row in rows
    ]
    if query:
        items = [
            item
            for item in items
            if query in " ".join(
                [
                    str(item.get("code") or ""),
                    str(item.get("employee_id") or ""),
                    str(item.get("emp_name") or ""),
                    str(item.get("note") or ""),
                    str(item.get("process_name") or ""),
                    str(item.get("type") or ""),
                    "ma pd" if item.get("kind") == "pd" else "ma co",
                ]
            ).lower()
        ]
    return items


def get_order(order_id, user=None):
    db = get_db()
    row = db.execute(
        """
        SELECT o.id, o.co, o.emp_id, o.process_id, o.note, o.created_at,
               e.name AS emp_name, p.name AS process_name
        FROM oders o
        LEFT JOIN emp e ON e.id = o.emp_id
        LEFT JOIN process p ON p.id = o.process_id
        WHERE o.id = ?
        """,
        (order_id,),
    ).fetchone()
    if not row:
        return None
    if user and user["role"] != "manager" and row["emp_id"] != user["id"]:
        return None
    _cfg_row, cfg = get_process_config(row["process_id"], db)
    return serialize_order(row, row["emp_name"], row["process_name"], cfg)


def add_orders(user, payload):
    codes_raw = payload.get("codes")
    if isinstance(codes_raw, str):
        codes_raw = [line for line in codes_raw.splitlines()]
    if not isinstance(codes_raw, list):
        codes_raw = [payload.get("co") or payload.get("code")]

    codes = []
    seen = set()
    for item in codes_raw:
        code = normalize_code(item)
        if not code or code in seen:
            continue
        seen.add(code)
        codes.append(code)
    if not codes:
        return None, "Nhập mã đơn."
    if len(codes) > MAX_ORDERS_PER_ENTRY:
        return None, f"Mỗi lần nhập tối đa {MAX_ORDERS_PER_ENTRY} đơn."

    process = find_process(payload.get("process_id"), payload.get("type") or payload.get("slug"))
    if not process:
        return None, "Chọn công đoạn."

    kind = get_kind(payload.get("kind"))
    if kind == "pd" and not process["allows_pd"]:
        return None, "Công đoạn này không dùng mã PD."

    seconds, seconds_error = parse_seconds(payload.get("seconds")) if "seconds" in payload else (None, "")
    if seconds_error:
        return None, seconds_error

    emp_id = user["id"]
    note = normalize_note(payload.get("note"))
    created_at = now_iso()
    added = []
    duplicates = []

    with transaction() as db:
        _cfg_row, cfg = get_process_config(process["id"], db)
        order_seconds = cfg.get("order_seconds") if isinstance(cfg.get("order_seconds"), dict) else {}
        for code in codes:
            stored = encode_co(code, kind)
            existing = db.execute(
                "SELECT id FROM oders WHERE co = ? AND process_id = ?",
                (stored, process["id"]),
            ).fetchone()
            if existing:
                duplicates.append(code)
                if seconds is not None:
                    order_seconds[str(existing["id"])] = seconds
                continue
            cursor = db.execute(
                """
                INSERT INTO oders (co, emp_id, process_id, note, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (stored, emp_id, process["id"], note, created_at),
            )
            if seconds is not None:
                order_seconds[str(cursor.lastrowid)] = seconds
            added.append(cursor.lastrowid)
        if seconds is not None:
            cfg["order_seconds"] = order_seconds
            save_process_config(process["id"], cfg, db)

    items = [get_order(order_id, user) for order_id in added]
    return {"added": items, "duplicates": duplicates, "orders": items}, ""


def update_order(order_id, user, payload):
    current = get_order(order_id, user)
    if not current:
        return None, "Không tìm thấy đơn hàng."
    if user["role"] != "manager" and current["emp_id"] != user["id"]:
        return None, "Không thể sửa đơn của người khác."

    code = normalize_code(payload["code"] if "code" in payload else current["code"])
    if not code:
        return None, "Nhập mã đơn."
    note = normalize_note(payload["note"] if "note" in payload else current["note"])
    kind = get_kind(payload["kind"] if "kind" in payload else current["kind"])
    process = find_process(
        payload.get("process_id"),
        payload.get("type") or payload.get("slug"),
    ) if ("process_id" in payload or "type" in payload or "slug" in payload) else get_process(current["process_id"])
    if not process:
        return None, "Chọn công đoạn."
    if kind == "pd" and not process["allows_pd"]:
        return None, "Công đoạn này không dùng mã PD."

    stored = encode_co(code, kind)
    with transaction() as db:
        duplicate = db.execute(
            "SELECT id FROM oders WHERE co = ? AND process_id = ? AND id != ?",
            (stored, process["id"], order_id),
        ).fetchone()
        if duplicate:
            message = (
                "Mã PD này đã có với cùng công đoạn."
                if kind == "pd"
                else "Mã CO này đã có với cùng công đoạn."
            )
            return None, message
        db.execute(
            "UPDATE oders SET co = ?, process_id = ?, note = ? WHERE id = ?",
            (stored, process["id"], note, order_id),
        )
        if current["process_id"] != process["id"]:
            _old_row, old_cfg = get_process_config(current["process_id"], db)
            order_seconds = old_cfg.get("order_seconds") if isinstance(old_cfg.get("order_seconds"), dict) else {}
            moved = order_seconds.pop(str(order_id), None)
            old_cfg["order_seconds"] = order_seconds
            save_process_config(current["process_id"], old_cfg, db)
            if moved is not None:
                _new_row, new_cfg = get_process_config(process["id"], db)
                new_seconds = new_cfg.get("order_seconds") if isinstance(new_cfg.get("order_seconds"), dict) else {}
                new_seconds[str(order_id)] = moved
                new_cfg["order_seconds"] = new_seconds
                save_process_config(process["id"], new_cfg, db)

    return get_order(order_id, user), ""


def delete_order(order_id, user):
    current = get_order(order_id, user)
    if not current:
        return False, "Không tìm thấy đơn hàng."
    if user["role"] != "manager" and current["emp_id"] != user["id"]:
        return False, "Không thể xóa đơn của người khác."
    with transaction() as db:
        db.execute("DELETE FROM oders WHERE id = ?", (order_id,))
        _cfg_row, cfg = get_process_config(current["process_id"], db)
        order_seconds = cfg.get("order_seconds") if isinstance(cfg.get("order_seconds"), dict) else {}
        if str(order_id) in order_seconds:
            order_seconds.pop(str(order_id), None)
            cfg["order_seconds"] = order_seconds
            save_process_config(current["process_id"], cfg, db)
    return True, ""


def delete_orders(ids, user):
    deleted = []
    errors = []
    for order_id in ids:
        parsed = parse_int(order_id)
        if parsed is None:
            continue
        ok, error = delete_order(parsed, user)
        if ok:
            deleted.append(parsed)
        elif error:
            errors.append({"id": parsed, "error": error})
    return deleted, errors


def clear_orders(user):
    db = get_db()
    if user["role"] == "manager":
        rows = db.execute("SELECT id, process_id FROM oders").fetchall()
    else:
        rows = db.execute(
            "SELECT id, process_id FROM oders WHERE emp_id = ?",
            (user["id"],),
        ).fetchall()
    ids = [row["id"] for row in rows]
    for order_id in ids:
        delete_order(order_id, user)
    return ids


def set_order_seconds(order_ids, seconds, user):
    if user["role"] != "manager":
        return None, "Chỉ quản lý mới sửa được số giây."
    value, error = parse_seconds(seconds) if seconds is not None else (None, "")
    if error:
        return None, error
    updated = []
    with transaction() as db:
        for order_id in order_ids:
            parsed = parse_int(order_id)
            if parsed is None:
                continue
            row = db.execute(
                "SELECT id, process_id FROM oders WHERE id = ?",
                (parsed,),
            ).fetchone()
            if not row:
                continue
            _cfg_row, cfg = get_process_config(row["process_id"], db)
            order_seconds = cfg.get("order_seconds") if isinstance(cfg.get("order_seconds"), dict) else {}
            if value is None:
                order_seconds.pop(str(parsed), None)
            else:
                order_seconds[str(parsed)] = value
            cfg["order_seconds"] = order_seconds
            save_process_config(row["process_id"], cfg, db)
            updated.append(parsed)
    if not updated:
        return None, "Không tìm thấy đơn hàng."
    return [get_order(order_id, user) for order_id in updated], ""


def get_settings():
    type_seconds = {}
    code_seconds = {}
    for process in list_processes():
        _row, cfg = get_process_config(process["id"])
        if isinstance(cfg.get("seconds"), int):
            type_seconds[process["slug"]] = cfg["seconds"]
        mapping = cfg.get("code_seconds") if isinstance(cfg.get("code_seconds"), dict) else {}
        for code, seconds in mapping.items():
            if isinstance(seconds, int) and code:
                code_seconds[f"{code}::{process['slug']}"] = seconds
    return {"type_seconds": type_seconds, "code_seconds": code_seconds}


def save_type_seconds(type_id, raw_seconds):
    process = find_process(slug=type_id) if not str(type_id).isdigit() else find_process(process_id=type_id)
    if not process:
        return None, "Không tìm thấy công đoạn."
    value, error = parse_seconds(raw_seconds) if raw_seconds is not None and raw_seconds != "" else (None, "")
    if error:
        return None, error
    with transaction() as db:
        _row, cfg = get_process_config(process["id"], db)
        if value is None:
            cfg.pop("seconds", None)
        else:
            cfg["seconds"] = value
        cfg["slug"] = process["slug"]
        save_process_config(process["id"], cfg, db)
    return get_settings(), ""


def save_code_seconds(type_id, codes, raw_seconds):
    process = find_process(slug=type_id) if not str(type_id).isdigit() else find_process(process_id=type_id)
    if not process:
        return None, "Không tìm thấy công đoạn."
    if not process["allows_pd"]:
        return None, "Công đoạn này không dùng mã PD."
    value, error = parse_seconds(raw_seconds)
    if error:
        return None, error
    unique = []
    seen = set()
    for item in codes if isinstance(codes, list) else [codes]:
        code = normalize_code(item)
        if not code or code in seen:
            continue
        seen.add(code)
        unique.append(code)
    if not unique:
        return None, "Nhập ít nhất một mã PD."
    with transaction() as db:
        _row, cfg = get_process_config(process["id"], db)
        mapping = cfg.get("code_seconds") if isinstance(cfg.get("code_seconds"), dict) else {}
        for code in unique:
            if value is None:
                mapping.pop(code, None)
            else:
                mapping[code] = value
        cfg["code_seconds"] = mapping
        cfg["slug"] = process["slug"]
        save_process_config(process["id"], cfg, db)
    return get_settings(), ""


def create_employee(payload):
    emp_id = parse_int(payload.get("id") or payload.get("employee_id"))
    name = str(payload.get("name") or "").strip()
    role = payload.get("role") or "employee"
    password = payload.get("password") or ""
    if emp_id is None:
        return None, "Nhập mã nhân viên."
    if not name:
        return None, "Nhập tên nhân viên."
    if role not in ROLES:
        return None, "Chọn vai trò."
    if not password:
        return None, "Nhập mật khẩu."
    if get_employee(emp_id):
        return None, "Mã nhân viên đã tồn tại."
    with transaction() as db:
        db.execute("INSERT INTO emp (id, name) VALUES (?, ?)", (emp_id, name))
        set_employee_auth(emp_id, role, password, db)
    return get_employee(emp_id), ""


def update_employee(emp_id, payload):
    current = get_employee(emp_id)
    if not current:
        return None, "Không tìm thấy nhân viên."
    name = str(payload["name"]).strip() if "name" in payload else current["name"]
    if not name:
        return None, "Nhập tên nhân viên."
    role = payload.get("role", current["role"])
    if role not in ROLES:
        return None, "Chọn vai trò."
    password = payload.get("password")
    with transaction() as db:
        db.execute("UPDATE emp SET name = ? WHERE id = ?", (name, current["id"]))
        set_employee_auth(current["id"], role, password, db)
    return get_employee(current["id"]), ""


def delete_employee(emp_id):
    current = get_employee(emp_id)
    if not current:
        return False, "Không tìm thấy nhân viên."
    db = get_db()
    used = db.execute("SELECT COUNT(*) AS n FROM oders WHERE emp_id = ?", (current["id"],)).fetchone()
    if used and used["n"]:
        return False, "Không thể xóa nhân viên đang có đơn hàng."
    with transaction() as db:
        db.execute("DELETE FROM emp WHERE id = ?", (current["id"],))
        delete_employee_auth(current["id"], db)
    return True, ""


def create_process(payload):
    name = str(payload.get("name") or "").strip()
    slug = str(payload.get("slug") or "").strip()
    if not name:
        return None, "Nhập tên công đoạn."
    db = get_db()
    process_id = parse_int(payload.get("id"))
    if process_id is None:
        row = db.execute("SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM process").fetchone()
        process_id = row["next_id"]
    if get_process(process_id):
        return None, "Mã công đoạn đã tồn tại."
    seconds, error = parse_seconds(payload["seconds"]) if "seconds" in payload else (None, "")
    if error:
        return None, error
    with transaction() as db:
        db.execute("INSERT INTO process (id, name) VALUES (?, ?)", (process_id, name))
        cfg = {"slug": slug or None}
        if seconds is not None:
            cfg["seconds"] = seconds
        save_process_config(process_id, cfg, db)
    return get_process(process_id), ""


def update_process(process_id, payload):
    current = get_process(process_id)
    if not current:
        return None, "Không tìm thấy công đoạn."
    name = str(payload["name"]).strip() if "name" in payload else current["name"]
    if not name:
        return None, "Nhập tên công đoạn."
    slug = str(payload["slug"]).strip() if "slug" in payload else current["slug"]
    seconds_value = None
    clear_seconds = False
    if "seconds" in payload:
        if payload["seconds"] in (None, ""):
            clear_seconds = True
        else:
            seconds_value, error = parse_seconds(payload["seconds"])
            if error:
                return None, error
    with transaction() as db:
        db.execute("UPDATE process SET name = ? WHERE id = ?", (name, current["id"]))
        _row, cfg = get_process_config(current["id"], db)
        if slug:
            cfg["slug"] = slug
        if clear_seconds:
            cfg.pop("seconds", None)
        elif "seconds" in payload:
            cfg["seconds"] = seconds_value
        save_process_config(current["id"], cfg, db)
    return get_process(current["id"]), ""


def delete_process(process_id):
    current = get_process(process_id)
    if not current:
        return False, "Không tìm thấy công đoạn."
    db = get_db()
    used = db.execute(
        "SELECT COUNT(*) AS n FROM oders WHERE process_id = ?",
        (current["id"],),
    ).fetchone()
    if used and used["n"]:
        return False, "Không thể xóa công đoạn đang có đơn hàng."
    with transaction() as db:
        db.execute("DELETE FROM process WHERE id = ?", (current["id"],))
        db.execute("DELETE FROM config WHERE process_id = ?", (current["id"],))
    return True, ""


def list_config():
    db = get_db()
    rows = db.execute(
        "SELECT id, process_id, data FROM config ORDER BY id"
    ).fetchall()
    items = []
    for row in rows:
        items.append(
            {
                "id": row["id"],
                "process_id": row["process_id"],
                "data": parse_data(row["data"]),
            }
        )
    return items


def upsert_config(payload):
    process_id = parse_int(payload.get("process_id"), default=None)
    data = payload.get("data")
    if not isinstance(data, dict):
        return None, "data phải là object JSON."
    config_id = parse_int(payload.get("id"))
    with transaction() as db:
        if config_id:
            row = db.execute("SELECT id FROM config WHERE id = ?", (config_id,)).fetchone()
            if not row:
                return None, "Không tìm thấy cấu hình."
            db.execute(
                "UPDATE config SET process_id = ?, data = ? WHERE id = ?",
                (process_id, dump_data(data), config_id),
            )
            saved_id = config_id
        elif process_id is None:
            save_system_config({**get_system_config(db), **data}, db)
            row = _system_config_row(db)
            saved_id = row["id"]
        else:
            _row, current = get_process_config(process_id, db)
            current.update(data)
            saved_id = save_process_config(process_id, current, db)
    row = get_db().execute(
        "SELECT id, process_id, data FROM config WHERE id = ?",
        (saved_id,),
    ).fetchone()
    return {"id": row["id"], "process_id": row["process_id"], "data": parse_data(row["data"])}, ""


def summarize_orders(orders, range_from=None, range_to=None):
    unique_co = set()
    unique_pd = set()
    type_counts = defaultdict(int)
    employee_stats = {}
    day_counts = defaultdict(lambda: defaultdict(int))

    for order in orders:
        if order.get("kind") == "pd":
            unique_pd.add(order.get("code"))
        else:
            unique_co.add(order.get("code"))
        slug = order.get("type") or ""
        type_counts[slug] += 1
        emp_id = order.get("employee_id") or "—"
        bucket = employee_stats.setdefault(
            emp_id,
            {
                "employee_id": emp_id,
                "name": order.get("emp_name"),
                "count": 0,
                "codes": set(),
                "co_codes": set(),
                "pd_codes": set(),
                "by_type": defaultdict(int),
            },
        )
        bucket["count"] += 1
        bucket["codes"].add(order.get("code"))
        if order.get("kind") == "pd":
            bucket["pd_codes"].add(order.get("code"))
        else:
            bucket["co_codes"].add(order.get("code"))
        bucket["by_type"][slug] += 1
        stamp = order.get("created_at")
        if stamp:
            day = str(stamp)[:10]
            day_counts[day][slug] += 1

    processes = list_processes()
    return {
        "total": len(orders),
        "unique_codes": len(unique_co),
        "unique_co_codes": len(unique_co),
        "unique_pd_codes": len(unique_pd),
        "from": range_from,
        "to": range_to,
        "by_type": [
            {
                "id": item["slug"],
                "process_id": item["id"],
                "label": item["name"],
                "count": type_counts.get(item["slug"], 0),
            }
            for item in processes
        ],
        "by_employee": [
            {
                "employee_id": bucket["employee_id"],
                "name": bucket["name"],
                "count": bucket["count"],
                "unique_codes": len(bucket["codes"]),
                "unique_co_codes": len(bucket["co_codes"]),
                "unique_pd_codes": len(bucket["pd_codes"]),
                "by_type": [
                    {
                        "id": item["slug"],
                        "process_id": item["id"],
                        "label": item["name"],
                        "count": bucket["by_type"].get(item["slug"], 0),
                    }
                    for item in processes
                ],
            }
            for _emp_id, bucket in sorted(employee_stats.items(), key=lambda item: str(item[0]))
        ],
        "by_day": [
            {
                "id": day,
                "count": sum(counts.values()),
                "by_type": [
                    {
                        "id": item["slug"],
                        "label": item["name"],
                        "count": counts.get(item["slug"], 0),
                    }
                    for item in processes
                ],
            }
            for day, counts in sorted(day_counts.items())
        ],
    }
