import re
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from flask import current_app, g, has_app_context

from .auth import hash_password, verify_password
from .constants import (
    MAX_ORDERS_PER_ENTRY,
    MAX_SECONDS,
    ORDER_PAGE_SIZE,
    PD_PREFIX,
    PD_PROCESS_SLUGS,
    PROCESS_BY_ID,
    PROCESS_BY_NAME,
    ROLES,
)
from .db import (
    batched,
    compact_text,
    dump_data,
    fold_text,
    get_db,
    parse_data,
    placeholders,
    row_dict,
    transaction,
)

ORDER_SELECT = """
    SELECT o.id, o.co, o.emp_id, o.process_id, o.note, o.created_at,
           e.name AS emp_name, p.name AS process_name
    FROM oders o
    LEFT JOIN emp e ON e.id = o.emp_id
    LEFT JOIN process p ON p.id = o.process_id
"""


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


def _next_day(value):
    try:
        year, month, day = (int(part) for part in value.split("-", 2))
        return (datetime(year, month, day) + timedelta(days=1)).date().isoformat()
    except (TypeError, ValueError):
        return None


def _local_day(stamp, offset_minutes):
    text = str(stamp or "").strip()
    if not text:
        return ""
    try:
        moment = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return text[:10]
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    local = moment - timedelta(minutes=offset_minutes or 0)
    return local.date().isoformat()


def _strip_search_quotes(raw):
    return re.sub(r"""^[\s"'“”‘’`]+|[\s"'“”‘’`]+$""", "", str(raw or ""))


def parse_search_needles(raw):
    tokens = []
    seen = set()
    for chunk in re.split(r"[\r\n,;]+", str(raw or "")):
        text = _strip_search_quotes(chunk).strip()
        if not text:
            continue
        words = text.split()
        as_codes = len(words) > 1 and all(
            re.search(r"\d", word) and len(re.sub(r"[^a-z0-9]", "", word, flags=re.I)) >= 3
            for word in words
        )
        pieces = words if as_codes else [text]
        for piece in pieces:
            needle = fold_text(_strip_search_quotes(piece))
            if not needle or needle in seen:
                continue
            seen.add(needle)
            tokens.append(needle)
    return tokens


def _needle_clause(needle, db):
    parts = [
        "instr(om_fold(o.co), ?) > 0",
        "instr(om_fold(ifnull(o.note, '')), ?) > 0",
        "instr(om_fold(ifnull(e.name, '')), ?) > 0",
        "instr(om_fold(ifnull(p.name, '')), ?) > 0",
        "instr(om_fold(CAST(o.emp_id AS TEXT)), ?) > 0",
    ]
    params = [needle] * 5
    compact = compact_text(needle)
    if len(compact) >= 3:
        parts.append("instr(om_compact(o.co), ?) > 0")
        params.append(compact)
    slug_ids = [
        item["id"]
        for item in process_catalog(db)["items"]
        if item.get("slug") and needle in fold_text(item["slug"])
    ]
    if slug_ids:
        parts.append(f"o.process_id IN ({placeholders(len(slug_ids))})")
        params.extend(slug_ids)
    if needle in ("pd", "ma pd") or "ma pd" in needle:
        parts.append("o.co LIKE ?")
        params.append(f"{PD_PREFIX}%")
    if needle in ("co", "ma co") or "ma co" in needle:
        parts.append("o.co NOT LIKE ?")
        params.append(f"{PD_PREFIX}%")
    return "(" + " OR ".join(parts) + ")", params


def invalidate_catalog():
    if has_app_context():
        g.pop("process_catalog", None)
        g.pop("auth_map", None)
        g.pop("system_config", None)


def _system_config_row(db=None):
    db = db or get_db()
    return db.execute(
        "SELECT id, process_id, data FROM config WHERE process_id IS NULL ORDER BY id LIMIT 1"
    ).fetchone()


def get_system_config(db=None):
    if has_app_context() and "system_config" in g:
        return g.system_config
    row = _system_config_row(db)
    payload = parse_data(row["data"] if row else None)
    if has_app_context():
        g.system_config = payload
    return payload


def save_system_config(payload, db=None):
    db = db or get_db()
    row = _system_config_row(db)
    data = dump_data(payload)
    if row:
        db.execute("UPDATE config SET data = ? WHERE id = ?", (data, row["id"]))
    else:
        db.execute("INSERT INTO config (process_id, data) VALUES (?, ?)", (None, data))
    if has_app_context():
        g.system_config = payload
        g.pop("auth_map", None)


def get_auth_map(db=None):
    if has_app_context() and "auth_map" in g:
        return g.auth_map
    auth = get_system_config(db).get("auth")
    mapping = auth if isinstance(auth, dict) else {}
    if has_app_context():
        g.auth_map = mapping
    return mapping


def get_employee_auth(emp_id, db=None):
    entry = get_auth_map(db).get(str(emp_id))
    return entry if isinstance(entry, dict) else {}


def set_employee_auth(emp_id, role, password=None, db=None):
    db = db or get_db()
    payload = dict(get_system_config(db))
    auth = dict(payload.get("auth") if isinstance(payload.get("auth"), dict) else {})
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
    payload = dict(get_system_config(db))
    auth = dict(payload.get("auth") if isinstance(payload.get("auth"), dict) else {})
    auth.pop(str(emp_id), None)
    payload["auth"] = auth
    save_system_config(payload, db)


def _process_config_map(db):
    mapping = {}
    for row in db.execute("SELECT process_id, data FROM config WHERE process_id IS NOT NULL"):
        if row["process_id"] not in mapping:
            mapping[row["process_id"]] = parse_data(row["data"])
    return mapping


def process_catalog(db=None):
    if has_app_context() and "process_catalog" in g:
        return g.process_catalog
    db = db or get_db()
    cfg_map = _process_config_map(db)
    items = []
    by_id = {}
    by_slug = {}
    for row in db.execute("SELECT id, name FROM process ORDER BY id"):
        item = serialize_process(row, cfg_map.get(row["id"]))
        items.append(item)
        by_id[item["id"]] = item
        if item["slug"]:
            by_slug[item["slug"]] = item
    catalog = {"items": items, "by_id": by_id, "by_slug": by_slug, "cfg": cfg_map}
    if has_app_context():
        g.process_catalog = catalog
    return catalog


def get_process_config(process_id, db=None):
    catalog = process_catalog(db) if has_app_context() and "process_catalog" in g else None
    if catalog and process_id in catalog["cfg"]:
        return None, dict(catalog["cfg"][process_id])
    db = db or get_db()
    row = db.execute(
        "SELECT id, process_id, data FROM config WHERE process_id = ? ORDER BY id LIMIT 1",
        (process_id,),
    ).fetchone()
    return row_dict(row), parse_data(row["data"] if row else None)


def save_process_config(process_id, payload, db=None):
    db = db or get_db()
    data = dump_data(payload)
    db.execute("UPDATE config SET data = ? WHERE process_id = ?", (data, process_id))
    changed = db.execute("SELECT changes()").fetchone()[0]
    if not changed:
        cursor = db.execute(
            "INSERT INTO config (process_id, data) VALUES (?, ?)",
            (process_id, data),
        )
        config_id = cursor.lastrowid
    else:
        row = db.execute(
            "SELECT id FROM config WHERE process_id = ? ORDER BY id LIMIT 1",
            (process_id,),
        ).fetchone()
        config_id = row["id"]
    invalidate_catalog()
    return config_id


def process_slug(process_id, name=None, config=None):
    if config and config.get("slug"):
        return config["slug"]
    mapped = PROCESS_BY_ID.get(process_id)
    if mapped:
        return mapped[0]
    if name and name in PROCESS_BY_NAME:
        return PROCESS_BY_NAME[name][1]
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


def get_process(process_id):
    process_id = parse_int(process_id)
    if process_id is None:
        return None
    return process_catalog()["by_id"].get(process_id)


def find_process(process_id=None, slug=None):
    catalog = process_catalog()
    if process_id is not None:
        pid = parse_int(process_id)
        return catalog["by_id"].get(pid)
    if slug:
        return catalog["by_slug"].get(slug)
    return None


def list_processes():
    return process_catalog()["items"]


EMP_SELECT = "SELECT id, name, pbb, pba FROM emp"


def normalize_emp_code(raw):
    return str(raw or "").strip()


def serialize_employee(row, auth=None):
    auth = auth or {}
    return {
        "id": row["id"],
        "employee_id": str(row["id"]),
        "name": row["name"],
        "pbb": row["pbb"] or "",
        "pba": row["pba"] or "",
        "role": auth.get("role") or "employee",
    }


def get_employee(emp_id):
    emp_id = parse_int(emp_id)
    if emp_id is None:
        return None
    row = get_db().execute(f"{EMP_SELECT} WHERE id = ?", (emp_id,)).fetchone()
    if not row:
        return None
    return serialize_employee(row, get_employee_auth(emp_id))


def list_employees():
    db = get_db()
    auth_map = get_auth_map(db)
    rows = db.execute(f"{EMP_SELECT} ORDER BY id").fetchall()
    return [serialize_employee(row, auth_map.get(str(row["id"]))) for row in rows]


def authenticate(employee_id, password, role):
    if role not in ROLES:
        return None, "Chọn vai trò."
    emp_id = parse_int(str(employee_id).strip() if employee_id is not None else "")
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


def _serialize_rows(rows, cfg_map=None):
    cfg_map = cfg_map if cfg_map is not None else process_catalog()["cfg"]
    return [
        serialize_order(row, row["emp_name"], row["process_name"], cfg_map.get(row["process_id"]))
        for row in rows
    ]


def get_orders_by_ids(ids, user=None, db=None):
    ids = [parse_int(item) for item in ids]
    ids = [item for item in ids if item is not None]
    if not ids:
        return []
    db = db or get_db()
    found = {}
    for chunk in batched(ids):
        sql = f"{ORDER_SELECT} WHERE o.id IN ({placeholders(len(chunk))})"
        for row in db.execute(sql, chunk):
            if user and user["role"] != "manager" and row["emp_id"] != user["id"]:
                continue
            found[row["id"]] = row
    cfg_map = process_catalog(db)["cfg"]
    items = []
    for order_id in ids:
        row = found.get(order_id)
        if row:
            items.append(
                serialize_order(row, row["emp_name"], row["process_name"], cfg_map.get(row["process_id"]))
            )
    return items


def _order_where(user, filters, needles):
    filters = filters or {}
    db = get_db()
    sql = ["FROM oders o", "LEFT JOIN emp e ON e.id = o.emp_id", "LEFT JOIN process p ON p.id = o.process_id", "WHERE 1 = 1"]
    params = []
    if user["role"] != "manager":
        sql.append("AND o.emp_id = ?")
        params.append(user["id"])
    elif filters.get("emp_id") not in (None, ""):
        sql.append("AND o.emp_id = ?")
        params.append(parse_int(filters["emp_id"]))

    process = None
    if filters.get("process_id") not in (None, ""):
        process = get_process(parse_int(filters["process_id"]))
    elif filters.get("type"):
        process = find_process(slug=filters["type"])
    if process:
        sql.append("AND o.process_id = ?")
        params.append(process["id"])

    if filters.get("kind") in ("co", "pd"):
        if filters["kind"] == "pd":
            sql.append("AND o.co LIKE ?")
            params.append(f"{PD_PREFIX}%")
        else:
            sql.append("AND o.co NOT LIKE ?")
            params.append(f"{PD_PREFIX}%")

    date_from = str(filters.get("from") or "").strip()
    date_to = str(filters.get("to") or "").strip()
    if date_from:
        sql.append("AND o.created_at >= ?")
        params.append(date_from)
    if date_to:
        if "T" in date_to:
            sql.append("AND o.created_at < ?")
            params.append(date_to)
        else:
            next_day = _next_day(date_to)
            if next_day:
                sql.append("AND o.created_at < ?")
                params.append(next_day)

    if needles:
        groups = []
        for needle in needles:
            clause, needle_params = _needle_clause(needle, db)
            groups.append(clause)
            params.extend(needle_params)
        sql.append("AND (" + " OR ".join(groups) + ")")
    return sql, params


def _count_orders(user, filters, needles):
    where, params = _order_where(user, filters, needles)
    row = get_db().execute("SELECT COUNT(*) AS n " + " ".join(where), params).fetchone()
    return int(row["n"] if row else 0)


def _unmatched_needles(user, filters, needles):
    if len(needles) < 2:
        return []
    scope = {
        key: value
        for key, value in (filters or {}).items()
        if key not in ("q", "query", "type", "kind", "from", "to", "process_id", "emp_id")
    }
    missing = []
    for needle in needles:
        if not re.search(r"\d", needle):
            continue
        if _count_orders(user, scope, [needle]) == 0:
            missing.append(needle)
    return missing


def _fetch_orders(user, filters, needles, limit=None, offset=0):
    where, params = _order_where(user, filters, needles)
    sql = [
        "SELECT o.id, o.co, o.emp_id, o.process_id, o.note, o.created_at,",
        "e.name AS emp_name, p.name AS process_name",
        *where,
        "ORDER BY o.created_at DESC, o.id DESC",
    ]
    if limit is not None:
        sql.append("LIMIT ? OFFSET ?")
        params = [*params, limit, offset]
    rows = get_db().execute(" ".join(sql), params).fetchall()
    return _serialize_rows(rows, process_catalog()["cfg"])


def _sync_capacity_orders():
    from .capacity import ensure_capacity_synced

    if current_app.config.get("CAPACITY_ROWS") is not None:
        ensure_capacity_synced()
        return
    if callable(current_app.config.get("CAPACITY_FETCHER")):
        ensure_capacity_synced()


def list_orders(user, filters=None):
    _sync_capacity_orders()
    filters = filters or {}
    needles = parse_search_needles(filters.get("q") or filters.get("query") or "")
    return _fetch_orders(user, filters, needles)


def list_orders_page(user, filters=None, page=1, page_size=ORDER_PAGE_SIZE):
    _sync_capacity_orders()
    filters = filters or {}
    needles = parse_search_needles(filters.get("q") or filters.get("query") or "")
    total = _count_orders(user, filters, needles)
    size = ORDER_PAGE_SIZE if page_size is None else max(1, min(int(page_size), ORDER_PAGE_SIZE))
    page_count = max(1, (total + size - 1) // size) if total else 1
    current = page if isinstance(page, int) and page > 0 else 1
    if current > page_count:
        current = page_count
    items = _fetch_orders(user, filters, needles, size, (current - 1) * size)
    return {
        "items": items,
        "total": total,
        "page": current,
        "page_size": size,
        "unmatched": _unmatched_needles(user, filters, needles),
    }


def get_order(order_id, user=None):
    items = get_orders_by_ids([order_id], user)
    return items[0] if items else None


def _existing_codes(db, process_id, stored_codes):
    found = {}
    for chunk in batched(stored_codes):
        rows = db.execute(
            f"SELECT id, co FROM oders WHERE process_id = ? AND co IN ({placeholders(len(chunk))})",
            [process_id, *chunk],
        )
        for row in rows:
            found[row["co"]] = row["id"]
    return found


def add_orders(user, payload):
    codes_raw = payload.get("codes")
    if isinstance(codes_raw, str):
        codes_raw = codes_raw.splitlines()
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

    raw_seconds = payload.get("seconds") if "seconds" in payload else None
    if raw_seconds not in (None, ""):
        if user["role"] != "manager":
            return None, "Chỉ quản lý mới sửa được số giây."
        seconds, seconds_error = parse_seconds(raw_seconds)
        if seconds_error:
            return None, seconds_error
    else:
        seconds = None

    emp_id = user["id"]
    note = normalize_note(payload.get("note"))
    created_at = now_iso()
    stored_list = [(code, encode_co(code, kind)) for code in codes]
    added_ids = []
    duplicates = []

    with transaction() as db:
        existing = _existing_codes(db, process["id"], [stored for _code, stored in stored_list])
        to_insert = []
        insert_codes = []
        _cfg_row, cfg = get_process_config(process["id"], db)
        order_seconds = dict(cfg.get("order_seconds") if isinstance(cfg.get("order_seconds"), dict) else {})
        for code, stored in stored_list:
            if stored in existing:
                duplicates.append(code)
                if seconds is not None:
                    order_seconds[str(existing[stored])] = seconds
                continue
            to_insert.append((stored, emp_id, process["id"], note, created_at))
            insert_codes.append(stored)
            existing[stored] = None
        if to_insert:
            db.executemany(
                """
                INSERT INTO oders (co, emp_id, process_id, note, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                to_insert,
            )
            inserted = _existing_codes(db, process["id"], insert_codes)
            for stored in insert_codes:
                order_id = inserted.get(stored)
                if order_id is None:
                    continue
                added_ids.append(order_id)
                if seconds is not None:
                    order_seconds[str(order_id)] = seconds
        if seconds is not None:
            cfg["order_seconds"] = order_seconds
            save_process_config(process["id"], cfg, db)

    items = get_orders_by_ids(added_ids, user)
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
    if "process_id" in payload or "type" in payload or "slug" in payload:
        process = find_process(
            payload.get("process_id"),
            payload.get("type") or payload.get("slug"),
        )
    else:
        process = get_process(current["process_id"])
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
            _move_order_seconds(db, order_id, current["process_id"], process["id"])

    return get_order(order_id, user), ""


def _move_order_seconds(db, order_id, from_process_id, to_process_id):
    _old_row, old_cfg = get_process_config(from_process_id, db)
    order_seconds = dict(old_cfg.get("order_seconds") if isinstance(old_cfg.get("order_seconds"), dict) else {})
    moved = order_seconds.pop(str(order_id), None)
    old_cfg["order_seconds"] = order_seconds
    save_process_config(from_process_id, old_cfg, db)
    if moved is None:
        return None
    _new_row, new_cfg = get_process_config(to_process_id, db)
    new_seconds = dict(new_cfg.get("order_seconds") if isinstance(new_cfg.get("order_seconds"), dict) else {})
    new_seconds[str(order_id)] = moved
    new_cfg["order_seconds"] = new_seconds
    save_process_config(to_process_id, new_cfg, db)
    return moved


def _strip_order_seconds(db, process_id, order_ids):
    if not order_ids:
        return
    _row, cfg = get_process_config(process_id, db)
    order_seconds = dict(cfg.get("order_seconds") if isinstance(cfg.get("order_seconds"), dict) else {})
    changed = False
    for order_id in order_ids:
        if str(order_id) in order_seconds:
            order_seconds.pop(str(order_id), None)
            changed = True
    if changed:
        cfg["order_seconds"] = order_seconds
        save_process_config(process_id, cfg, db)


def _delete_ids(db, ids):
    for chunk in batched(ids):
        db.execute(f"DELETE FROM oders WHERE id IN ({placeholders(len(chunk))})", chunk)


def delete_order(order_id, user):
    deleted, errors = delete_orders([order_id], user)
    if deleted:
        return True, ""
    if errors:
        return False, errors[0]["error"]
    return False, "Không tìm thấy đơn hàng."


def delete_orders(ids, user):
    parsed = []
    seen = set()
    for item in ids:
        order_id = parse_int(item)
        if order_id is None or order_id in seen:
            continue
        seen.add(order_id)
        parsed.append(order_id)
    if not parsed:
        return [], []

    db = get_db()
    found = {}
    for chunk in batched(parsed):
        rows = db.execute(
            f"SELECT id, emp_id, process_id FROM oders WHERE id IN ({placeholders(len(chunk))})",
            chunk,
        )
        for row in rows:
            found[row["id"]] = row

    deleted = []
    errors = []
    allowed = []
    for order_id in parsed:
        row = found.get(order_id)
        if not row or (user["role"] != "manager" and row["emp_id"] != user["id"]):
            errors.append({"id": order_id, "error": "Không tìm thấy đơn hàng."})
            continue
        allowed.append(row)
        deleted.append(order_id)

    if allowed:
        by_process = defaultdict(list)
        for row in allowed:
            by_process[row["process_id"]].append(row["id"])
        with transaction() as db:
            _delete_ids(db, deleted)
            for process_id, order_ids in by_process.items():
                _strip_order_seconds(db, process_id, order_ids)
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
    if not ids:
        return []
    by_process = defaultdict(list)
    for row in rows:
        by_process[row["process_id"]].append(row["id"])
    with transaction() as db:
        if user["role"] == "manager":
            db.execute("DELETE FROM oders")
        else:
            db.execute("DELETE FROM oders WHERE emp_id = ?", (user["id"],))
        for process_id, order_ids in by_process.items():
            _strip_order_seconds(db, process_id, order_ids)
    return ids


def set_order_seconds(order_ids, seconds, user):
    if user["role"] != "manager":
        return None, "Chỉ quản lý mới sửa được số giây."
    value, error = parse_seconds(seconds) if seconds is not None else (None, "")
    if error:
        return None, error
    parsed = []
    seen = set()
    for item in order_ids:
        order_id = parse_int(item)
        if order_id is None or order_id in seen:
            continue
        seen.add(order_id)
        parsed.append(order_id)
    if not parsed:
        return None, "Không tìm thấy đơn hàng."

    with transaction() as db:
        found = {}
        for chunk in batched(parsed):
            rows = db.execute(
                f"SELECT id, process_id FROM oders WHERE id IN ({placeholders(len(chunk))})",
                chunk,
            )
            for row in rows:
                found[row["id"]] = row["process_id"]
        updated = [order_id for order_id in parsed if order_id in found]
        if not updated:
            return None, "Không tìm thấy đơn hàng."
        by_process = defaultdict(list)
        for order_id in updated:
            by_process[found[order_id]].append(order_id)
        for process_id, ids in by_process.items():
            _row, cfg = get_process_config(process_id, db)
            order_seconds = dict(cfg.get("order_seconds") if isinstance(cfg.get("order_seconds"), dict) else {})
            for order_id in ids:
                key = str(order_id)
                if value is None:
                    order_seconds.pop(key, None)
                else:
                    order_seconds[key] = value
            cfg["order_seconds"] = order_seconds
            save_process_config(process_id, cfg, db)
    return get_orders_by_ids(updated, user), ""


def get_settings():
    catalog = process_catalog()
    type_seconds = {}
    code_seconds = {}
    for process in catalog["items"]:
        cfg = catalog["cfg"].get(process["id"]) or {}
        if isinstance(cfg.get("seconds"), int) and process["slug"]:
            type_seconds[process["slug"]] = cfg["seconds"]
        mapping = cfg.get("code_seconds") if isinstance(cfg.get("code_seconds"), dict) else {}
        slug = process["slug"]
        if not slug:
            continue
        for code, seconds in mapping.items():
            if isinstance(seconds, int) and code:
                code_seconds[f"{code}::{slug}"] = seconds
    return {"type_seconds": type_seconds, "code_seconds": code_seconds}


def _resolve_process(type_id):
    text = str(type_id) if type_id is not None else ""
    if text.isdigit():
        return find_process(process_id=text)
    return find_process(slug=text)


def save_type_seconds(type_id, raw_seconds, clear_order_seconds=False):
    process = _resolve_process(type_id)
    if not process:
        return None, "Không tìm thấy công đoạn."
    value, error = parse_seconds(raw_seconds) if raw_seconds is not None and raw_seconds != "" else (None, "")
    if error:
        return None, error
    with transaction() as db:
        _row, cfg = get_process_config(process["id"], db)
        if clear_order_seconds:
            cfg["order_seconds"] = {}
        if value is None:
            cfg.pop("seconds", None)
        else:
            cfg["seconds"] = value
        cfg["slug"] = process["slug"]
        save_process_config(process["id"], cfg, db)
    return get_settings(), ""


def save_code_seconds(type_id, codes, raw_seconds):
    process = _resolve_process(type_id)
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
        mapping = dict(cfg.get("code_seconds") if isinstance(cfg.get("code_seconds"), dict) else {})
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
    pbb = normalize_emp_code(payload.get("pbb"))
    pba = normalize_emp_code(payload.get("pba"))
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
        db.execute(
            "INSERT INTO emp (id, name, pbb, pba) VALUES (?, ?, ?, ?)",
            (emp_id, name, pbb, pba),
        )
        set_employee_auth(emp_id, role, password, db)
    return get_employee(emp_id), ""


def update_employee(emp_id, payload):
    current = get_employee(emp_id)
    if not current:
        return None, "Không tìm thấy nhân viên."
    name = str(payload["name"]).strip() if "name" in payload else current["name"]
    if not name:
        return None, "Nhập tên nhân viên."
    pbb = normalize_emp_code(payload["pbb"]) if "pbb" in payload else current["pbb"]
    pba = normalize_emp_code(payload["pba"]) if "pba" in payload else current["pba"]
    role = payload.get("role", current["role"])
    if role not in ROLES:
        return None, "Chọn vai trò."
    password = payload.get("password")
    with transaction() as db:
        db.execute(
            "UPDATE emp SET name = ?, pbb = ?, pba = ? WHERE id = ?",
            (name, pbb, pba, current["id"]),
        )
        set_employee_auth(current["id"], role, password, db)
    return get_employee(current["id"]), ""


def delete_employee(emp_id):
    current = get_employee(emp_id)
    if not current:
        return False, "Không tìm thấy nhân viên."
    db = get_db()
    used = db.execute(
        "SELECT 1 FROM oders WHERE emp_id = ? LIMIT 1",
        (current["id"],),
    ).fetchone()
    if used:
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
        "SELECT 1 FROM oders WHERE process_id = ? LIMIT 1",
        (current["id"],),
    ).fetchone()
    if used:
        return False, "Không thể xóa công đoạn đang có đơn hàng."
    with transaction() as db:
        db.execute("DELETE FROM process WHERE id = ?", (current["id"],))
        db.execute("DELETE FROM config WHERE process_id = ?", (current["id"],))
    invalidate_catalog()
    return True, ""


def list_config():
    db = get_db()
    return [
        {
            "id": row["id"],
            "process_id": row["process_id"],
            "data": parse_data(row["data"]),
        }
        for row in db.execute("SELECT id, process_id, data FROM config ORDER BY id")
    ]


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
            invalidate_catalog()
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


def summarize_orders(orders, range_from=None, range_to=None, tz_offset=0):
    unique_co = set()
    unique_pd = set()
    type_counts = defaultdict(int)
    type_seconds = defaultdict(int)
    type_seconds_seen = defaultdict(bool)
    employee_stats = {}
    day_counts = defaultdict(lambda: defaultdict(int))
    seconds_total = 0
    seconds_seen = False
    offset = parse_int(tz_offset, 0) or 0

    for order in orders:
        code = order.get("code")
        slug = order.get("type") or ""
        is_pd = order.get("kind") == "pd"
        if is_pd:
            unique_pd.add(code)
        else:
            unique_co.add(code)
        type_counts[slug] += 1
        seconds = order.get("seconds")
        if isinstance(seconds, int):
            seconds_seen = True
            seconds_total += seconds
            type_seconds[slug] += seconds
            type_seconds_seen[slug] = True
        emp_id = order.get("employee_id") or "—"
        bucket = employee_stats.get(emp_id)
        if bucket is None:
            bucket = {
                "employee_id": emp_id,
                "name": order.get("emp_name"),
                "count": 0,
                "seconds": 0,
                "seconds_seen": False,
                "codes": set(),
                "co_codes": set(),
                "pd_codes": set(),
                "by_type": defaultdict(int),
            }
            employee_stats[emp_id] = bucket
        bucket["count"] += 1
        if isinstance(seconds, int):
            bucket["seconds"] += seconds
            bucket["seconds_seen"] = True
        bucket["codes"].add(code)
        if is_pd:
            bucket["pd_codes"].add(code)
        else:
            bucket["co_codes"].add(code)
        bucket["by_type"][slug] += 1
        stamp = order.get("created_at")
        if stamp:
            day_counts[_local_day(stamp, offset)][slug] += 1

    processes = list_processes()
    return {
        "total": len(orders),
        "unique_codes": len(unique_co),
        "unique_co_codes": len(unique_co),
        "unique_pd_codes": len(unique_pd),
        "seconds_total": seconds_total if seconds_seen else None,
        "from": range_from,
        "to": range_to,
        "by_type": [
            {
                "id": item["slug"],
                "process_id": item["id"],
                "label": item["name"],
                "count": type_counts.get(item["slug"], 0),
                "seconds": type_seconds.get(item["slug"], 0) if type_seconds_seen[item["slug"]] else None,
            }
            for item in processes
        ],
        "by_employee": [
            {
                "employee_id": bucket["employee_id"],
                "name": bucket["name"],
                "count": bucket["count"],
                "seconds": bucket["seconds"] if bucket["seconds_seen"] else None,
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
