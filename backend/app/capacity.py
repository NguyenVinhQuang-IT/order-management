import gzip
import json
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

from flask import current_app, has_app_context

from .constants import PD_PREFIX, PROCESS_BY_SLUG
from .db import batched, get_db, placeholders, transaction

DEFAULT_CAPACITY_URL = "http://192.168.101.65:8088/data/xep-ban-capacity.json"
DEFAULT_INTERVAL_SECONDS = 7200
DEFAULT_TTL_SECONDS = DEFAULT_INTERVAL_SECONDS
DEFAULT_TIMEOUT_SECONDS = 90
INSERT_BATCH = 500
MIN_INTERVAL_SECONDS = 60

PROCESS_BY_PREFIX = {
    "PBB": "lam-don",
    "PBA": "kiem-don",
}


class CapacityError(Exception):
    pass


def normalize_scan_code(raw):
    return str(raw or "").strip().upper()


def _now_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _stamp(raw):
    text = str(raw or "").strip()
    if not text:
        return None
    if " " in text and "T" not in text[:20]:
        text = text.replace(" ", "T", 1)
    return text


def _state():
    store = current_app.extensions
    state = store.get("om_capacity")
    if state is None:
        state = {
            "lock": threading.Lock(),
            "fetched_at": 0.0,
            "updated_at": "",
            "error": "",
        }
        store["om_capacity"] = state
    return state


def reset_capacity_cache():
    if has_app_context():
        current_app.extensions.pop("om_capacity", None)


def _ttl():
    try:
        return max(0, int(current_app.config.get("CAPACITY_TTL", DEFAULT_TTL_SECONDS)))
    except (TypeError, ValueError):
        return DEFAULT_TTL_SECONDS


def _timeout():
    try:
        return max(5, int(current_app.config.get("CAPACITY_TIMEOUT", DEFAULT_TIMEOUT_SECONDS)))
    except (TypeError, ValueError):
        return DEFAULT_TIMEOUT_SECONDS


def _process_ids():
    mapping = {}
    for prefix, slug in PROCESS_BY_PREFIX.items():
        item = PROCESS_BY_SLUG.get(slug)
        if item:
            mapping[prefix] = item[0]
    return mapping


def _employee_maps(db):
    pbb = {}
    pba = {}
    for row in db.execute("SELECT id, pbb, pba FROM emp"):
        emp_id = row["id"]
        code_pbb = normalize_scan_code(row["pbb"])
        code_pba = normalize_scan_code(row["pba"])
        if code_pbb:
            pbb[code_pbb] = emp_id
        if code_pba:
            pba[code_pba] = emp_id
    return pbb, pba


def _read_bytes(url):
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "Accept-Encoding": "gzip",
            "User-Agent": "order-management",
        },
    )
    with urllib.request.urlopen(request, timeout=_timeout()) as response:
        raw = response.read()
        encoding = (response.headers.get("Content-Encoding") or "").lower()
    if encoding == "gzip" or raw[:2] == b"\x1f\x8b":
        raw = gzip.decompress(raw)
    return raw


def fetch_capacity_payload():
    injected = current_app.config.get("CAPACITY_FETCHER")
    if callable(injected):
        payload = injected()
        if not isinstance(payload, dict):
            raise CapacityError("Dữ liệu CO ERP không hợp lệ.")
        return payload

    rows = current_app.config.get("CAPACITY_ROWS")
    if rows is not None:
        if isinstance(rows, dict):
            return rows
        if not isinstance(rows, list):
            raise CapacityError("Dữ liệu CO ERP không hợp lệ.")
        return {
            "rows": rows,
            "updatedAt": current_app.config.get("CAPACITY_UPDATED_AT") or "",
        }

    url = str(current_app.config.get("CAPACITY_URL") or DEFAULT_CAPACITY_URL).strip()
    if not url:
        raise CapacityError("Không kết nối được máy chủ ERP.")
    sep = "&" if "?" in url else "?"
    url = f"{url}{sep}v={int(time.time() * 1000)}"
    try:
        raw = _read_bytes(url)
    except urllib.error.HTTPError as error:
        raise CapacityError(f"ERP trả về HTTP {error.code}.") from error
    except urllib.error.URLError as error:
        raise CapacityError("Không kết nối được máy chủ ERP.") from error
    except TimeoutError as error:
        raise CapacityError("Hết thời gian chờ dữ liệu CO từ ERP.") from error
    except OSError as error:
        raise CapacityError("Không kết nối được máy chủ ERP.") from error
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as error:
        raise CapacityError("Dữ liệu CO ERP không phải JSON.") from error
    if isinstance(payload, list):
        return {"rows": payload, "updatedAt": ""}
    if not isinstance(payload, dict):
        raise CapacityError("Dữ liệu CO ERP không hợp lệ.")
    return payload


def _iter_insert_rows(payload, pbb_map, pba_map, process_ids):
    rows = payload.get("rows") if isinstance(payload, dict) else payload
    if not isinstance(rows, list):
        return
    lam_id = process_ids.get("PBB")
    kiem_id = process_ids.get("PBA")
    seen = set()
    for row in rows:
        if not isinstance(row, dict):
            continue
        scan = normalize_scan_code(row.get("scanEmployeeCode") or row.get("employeeCode"))
        if not scan:
            continue
        prefix = scan[:3]
        if prefix == "PBB":
            process_id = lam_id
            emp_id = pbb_map.get(scan)
        elif prefix == "PBA":
            process_id = kiem_id
            emp_id = pba_map.get(scan)
        else:
            continue
        if process_id is None or emp_id is None:
            continue
        code = normalize_scan_code(row.get("orderNo"))
        if not code:
            continue
        key = (code, process_id)
        if key in seen:
            continue
        seen.add(key)
        created_at = _stamp(row.get("employeeCompletionTime")) or _stamp(row.get("receiveTime")) or _now_iso()
        yield (code, emp_id, process_id, "", created_at)


def _replace_erp_orders(process_ids, rows):
    lam_id = process_ids.get("PBB")
    kiem_id = process_ids.get("PBA")
    target_ids = [item for item in (lam_id, kiem_id) if item is not None]
    if not target_ids:
        return 0
    from .services import _strip_order_seconds

    with transaction() as db:
        old = db.execute(
            f"""
            SELECT id, process_id FROM oders
            WHERE process_id IN ({placeholders(len(target_ids))})
              AND ifnull(co, '') NOT LIKE ?
            """,
            (*target_ids, f"{PD_PREFIX}%"),
        ).fetchall()
        old_ids = [row["id"] for row in old]
        by_process = {}
        for row in old:
            by_process.setdefault(row["process_id"], []).append(row["id"])
        for chunk in batched(old_ids):
            db.execute(
                f"DELETE FROM oders WHERE id IN ({placeholders(len(chunk))})",
                chunk,
            )
        for process_id, order_ids in by_process.items():
            _strip_order_seconds(db, process_id, order_ids)
        inserted = 0
        for chunk in batched(rows, INSERT_BATCH):
            before = db.total_changes
            db.executemany(
                """
                INSERT INTO oders (co, emp_id, process_id, note, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                chunk,
            )
            inserted += db.total_changes - before
        return inserted


def _should_fetch():
    if current_app.config.get("CAPACITY_ROWS") is not None:
        return True
    if callable(current_app.config.get("CAPACITY_FETCHER")):
        return True
    if current_app.config.get("TESTING"):
        return False
    return True


def ensure_capacity_synced(force=False):
    if not has_app_context() or not _should_fetch():
        return
    process_ids = _process_ids()
    if not process_ids:
        return
    state = _state()
    now = time.time()
    ttl = _ttl()
    if not force and state["fetched_at"] and ttl and (now - state["fetched_at"]) < ttl:
        return
    with state["lock"]:
        now = time.time()
        if not force and state["fetched_at"] and ttl and (now - state["fetched_at"]) < ttl:
            return
        try:
            payload = fetch_capacity_payload()
        except CapacityError as error:
            state["error"] = str(error)
            state["fetched_at"] = now
            return
        updated_at = str(payload.get("updatedAt") or payload.get("updated_at") or "")
        raw_rows = payload.get("rows") if isinstance(payload, dict) else payload
        if not isinstance(raw_rows, list) or not raw_rows:
            state["error"] = "ERP không có dữ liệu làm đơn / kiểm đơn."
            state["fetched_at"] = now
            return
        db = get_db()
        pbb_map, pba_map = _employee_maps(db)
        if not pbb_map and not pba_map:
            state["fetched_at"] = now
            state["updated_at"] = updated_at
            state["error"] = ""
            return
        rows = list(_iter_insert_rows(payload, pbb_map, pba_map, process_ids))
        if not rows:
            state["fetched_at"] = now
            state["updated_at"] = updated_at
            state["error"] = ""
            return
        _replace_erp_orders(process_ids, rows)
        state["fetched_at"] = time.time()
        state["updated_at"] = updated_at
        state["error"] = ""


def stop_capacity_scheduler(app=None):
    if app is None:
        if not has_app_context():
            return
        app = current_app
    sched = app.extensions.pop("om_capacity_scheduler", None)
    if sched:
        sched["stop"].set()


def start_capacity_scheduler(app):
    if app.config.get("TESTING"):
        return
    if app.config.get("CAPACITY_SCHEDULER") is False:
        return
    if app.extensions.get("om_capacity_scheduler"):
        return

    stop = threading.Event()
    try:
        interval = max(MIN_INTERVAL_SECONDS, int(app.config.get("CAPACITY_INTERVAL") or DEFAULT_INTERVAL_SECONDS))
    except (TypeError, ValueError):
        interval = DEFAULT_INTERVAL_SECONDS

    def run():
        while not stop.is_set():
            with app.app_context():
                try:
                    ensure_capacity_synced(force=True)
                except Exception:
                    app.logger.exception("capacity sync failed")
            if stop.wait(interval):
                break

    thread = threading.Thread(target=run, name="om-capacity-sync", daemon=True)
    app.extensions["om_capacity_scheduler"] = {"thread": thread, "stop": stop}
    thread.start()
