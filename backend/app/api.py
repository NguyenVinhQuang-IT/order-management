from flask import Blueprint, jsonify, request

from .auth import create_token, get_current_user, login_required, manager_required
from .constants import ORDER_PAGE_SIZE
from .services import (
    add_orders,
    authenticate,
    clear_orders,
    create_employee,
    create_process,
    delete_employee,
    delete_order,
    delete_orders,
    delete_process,
    find_process,
    get_employee,
    get_order,
    get_process,
    get_settings,
    list_config,
    list_employees,
    list_orders,
    list_orders_page,
    list_processes,
    save_code_seconds,
    save_type_seconds,
    set_order_seconds,
    summarize_orders,
    update_employee,
    update_order,
    update_process,
    upsert_config,
)

bp = Blueprint("api", __name__, url_prefix="/api")


def json_body():
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


def fail(message, status=400):
    return jsonify({"error": message}), status


@bp.get("/health")
def health():
    return jsonify({"ok": True})


@bp.post("/auth/login")
def login():
    body = json_body()
    employee, error = authenticate(
        body.get("employee_id") or body.get("id"),
        body.get("password"),
        body.get("role"),
    )
    if error:
        status = 400 if error == "Chọn vai trò." else 401
        return fail(error, status)
    token = create_token({"id": employee["id"], "role": employee["role"]})
    return jsonify({"token": token, "user": employee})


@bp.get("/auth/me")
@login_required
def me():
    return jsonify({"user": get_current_user()})


@bp.post("/auth/logout")
@login_required
def logout():
    return jsonify({"ok": True})


@bp.get("/employees")
@login_required
def employees_index():
    return jsonify({"items": list_employees()})


@bp.get("/employees/<int:emp_id>")
@login_required
def employees_show(emp_id):
    item = get_employee(emp_id)
    if not item:
        return fail("Không tìm thấy nhân viên.", 404)
    return jsonify(item)


@bp.post("/employees")
@manager_required
def employees_create():
    item, error = create_employee(json_body())
    if error:
        return fail(error)
    return jsonify(item), 201


@bp.put("/employees/<int:emp_id>")
@manager_required
def employees_update(emp_id):
    item, error = update_employee(emp_id, json_body())
    if error:
        status = 404 if error == "Không tìm thấy nhân viên." else 400
        return fail(error, status)
    return jsonify(item)


@bp.delete("/employees/<int:emp_id>")
@manager_required
def employees_delete(emp_id):
    ok, error = delete_employee(emp_id)
    if not ok:
        status = 404 if error == "Không tìm thấy nhân viên." else 400
        return fail(error, status)
    return jsonify({"ok": True})


@bp.get("/processes")
@login_required
def processes_index():
    return jsonify({"items": list_processes()})


@bp.get("/processes/<int:process_id>")
@login_required
def processes_show(process_id):
    item = get_process(process_id)
    if not item:
        return fail("Không tìm thấy công đoạn.", 404)
    return jsonify(item)


@bp.post("/processes")
@manager_required
def processes_create():
    item, error = create_process(json_body())
    if error:
        return fail(error)
    return jsonify(item), 201


@bp.put("/processes/<int:process_id>")
@manager_required
def processes_update(process_id):
    item, error = update_process(process_id, json_body())
    if error:
        status = 404 if error == "Không tìm thấy công đoạn." else 400
        return fail(error, status)
    return jsonify(item)


@bp.delete("/processes/<int:process_id>")
@manager_required
def processes_delete(process_id):
    ok, error = delete_process(process_id)
    if not ok:
        status = 404 if error == "Không tìm thấy công đoạn." else 400
        return fail(error, status)
    return jsonify({"ok": True})


@bp.get("/orders")
@login_required
def orders_index():
    page = request.args.get("page", 1, type=int)
    result = list_orders_page(get_current_user(), request.args, page, ORDER_PAGE_SIZE)
    return jsonify(result)


@bp.get("/orders/<int:order_id>")
@login_required
def orders_show(order_id):
    item = get_order(order_id, get_current_user())
    if not item:
        return fail("Không tìm thấy đơn hàng.", 404)
    return jsonify(item)


@bp.post("/orders")
@login_required
def orders_create():
    result, error = add_orders(get_current_user(), json_body())
    if error:
        return fail(error)
    return jsonify(result), 201


@bp.put("/orders/<int:order_id>")
@login_required
def orders_update(order_id):
    item, error = update_order(order_id, get_current_user(), json_body())
    if error:
        status = 404 if error == "Không tìm thấy đơn hàng." else 400
        return fail(error, status)
    return jsonify(item)


@bp.delete("/orders/<int:order_id>")
@login_required
def orders_delete(order_id):
    ok, error = delete_order(order_id, get_current_user())
    if not ok:
        status = 404 if error == "Không tìm thấy đơn hàng." else 403 if "người khác" in error else 400
        return fail(error, status)
    return jsonify({"ok": True})


@bp.post("/orders/delete")
@login_required
def orders_bulk_delete():
    body = json_body()
    ids = body.get("ids") or []
    if not isinstance(ids, list) or not ids:
        return fail("Chọn ít nhất một mã đơn.")
    deleted, errors = delete_orders(ids, get_current_user())
    return jsonify({"deleted": deleted, "errors": errors})


@bp.post("/orders/clear")
@login_required
def orders_clear():
    deleted = clear_orders(get_current_user())
    return jsonify({"deleted": deleted})


@bp.put("/orders/<int:order_id>/seconds")
@manager_required
def orders_seconds(order_id):
    items, error = set_order_seconds([order_id], json_body().get("seconds"), get_current_user())
    if error:
        status = 404 if error == "Không tìm thấy đơn hàng." else 400
        return fail(error, status)
    return jsonify(items[0])


@bp.put("/orders/seconds")
@manager_required
def orders_seconds_bulk():
    body = json_body()
    ids = body.get("ids") or []
    if not isinstance(ids, list) or not ids:
        return fail("Chọn ít nhất một mã đơn.")
    items, error = set_order_seconds(ids, body.get("seconds"), get_current_user())
    if error:
        return fail(error)
    return jsonify({"items": items})


@bp.get("/config")
@login_required
def config_index():
    return jsonify({"items": list_config()})


@bp.post("/config")
@manager_required
def config_upsert():
    item, error = upsert_config(json_body())
    if error:
        status = 404 if error == "Không tìm thấy cấu hình." else 400
        return fail(error, status)
    return jsonify(item)


@bp.get("/settings")
@login_required
def settings_index():
    return jsonify(get_settings())


@bp.put("/settings/type-seconds")
@manager_required
def settings_type_seconds():
    body = json_body()
    item, error = save_type_seconds(
        body.get("type") or body.get("slug") or body.get("process_id"),
        body.get("seconds"),
        clear_order_seconds=body.get("clear_order_seconds") is True,
    )
    if error:
        return fail(error)
    return jsonify(item)


@bp.put("/settings/code-seconds")
@manager_required
def settings_code_seconds():
    body = json_body()
    item, error = save_code_seconds(
        body.get("type") or body.get("slug") or body.get("process_id"),
        body.get("codes"),
        body.get("seconds"),
    )
    if error:
        return fail(error)
    return jsonify(item)


@bp.get("/stats")
@login_required
def stats_index():
    user = get_current_user()
    if user["role"] != "manager":
        return fail("Chỉ quản lý mới xem được thống kê.", 403)
    filters = {
        "from": request.args.get("from"),
        "to": request.args.get("to"),
        "emp_id": request.args.get("emp_id"),
        "process_id": request.args.get("process_id"),
        "type": request.args.get("type"),
        "kind": request.args.get("kind"),
        "q": request.args.get("q"),
    }
    orders = list_orders(user, filters)
    offset = request.args.get("tz_offset", 0, type=int)
    return jsonify(summarize_orders(orders, filters.get("from"), filters.get("to"), offset))


@bp.get("/lookup/process")
@login_required
def lookup_process():
    item = find_process(request.args.get("id"), request.args.get("slug") or request.args.get("type"))
    if not item:
        return fail("Không tìm thấy công đoạn.", 404)
    return jsonify(item)


def register_error_handlers(app):
    @app.errorhandler(404)
    def not_found(_error):
        return fail("Không tìm thấy.", 404)

    @app.errorhandler(405)
    def method_not_allowed(_error):
        return fail("Phương thức không hợp lệ.", 405)
