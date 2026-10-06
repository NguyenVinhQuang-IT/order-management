from app import create_app
from app.db import reset_tables
from app.seed import seed_if_empty

ERP_ROWS = [
    {
        "orderNo": "CO26092800002",
        "scanEmployeeCode": "PBB0099",
        "employeeCompletionTime": "2026-09-28 15:02:53",
    },
    {
        "orderNo": "CO26092800002",
        "scanEmployeeCode": "PBA0099",
        "employeeCompletionTime": "2026-09-28 14:59:39",
    },
    {
        "orderNo": "COERP-SKIP",
        "scanEmployeeCode": "PBB0004",
        "employeeCompletionTime": "2026-09-28 14:00:00",
    },
    {
        "orderNo": "co26092800002",
        "scanEmployeeCode": "PBB0099",
        "employeeCompletionTime": "2026-09-28 16:00:00",
    },
    {
        "orderNo": "CO26070400817",
        "scanEmployeeCode": "PBA0099",
        "employeeCompletionTime": "2026-07-04 16:11:43",
    },
]


def _app(_tmp_path=None, **extra):
    config = {
        "TESTING": True,
        "SECRET_KEY": "test-secret",
        "CAPACITY_ROWS": ERP_ROWS,
        "CAPACITY_TTL": 300,
        "CAPACITY_UPDATED_AT": "test-1",
    }
    config.update(extra)
    application = create_app(config)
    with application.app_context():
        reset_tables()
        seed_if_empty()
    return application


def _login(client, employee_id="1", role="employee"):
    response = client.post(
        "/api/auth/login",
        json={"employee_id": employee_id, "password": "123456", "role": role},
    )
    token = response.get_json()["token"]
    return {"Authorization": f"Bearer {token}"}


def _assign_codes(client, emp_id, pbb, pba):
    manager = _login(client, "169", "manager")
    updated = client.put(
        f"/api/employees/{emp_id}",
        json={"pbb": pbb, "pba": pba},
        headers=manager,
    )
    assert updated.status_code == 200


def test_erp_orders_appear_in_table_for_matching_employee(tmp_path):
    app = _app(tmp_path)
    client = app.test_client()
    _assign_codes(client, 1, "PBB0099", "PBA0099")

    headers = _login(client, "1", "employee")
    listed = client.get("/api/orders", headers=headers)
    assert listed.status_code == 200
    payload = listed.get_json()
    assert payload["total"] == 3
    items = payload["items"]
    by_key = {(item["code"], item["type"]): item for item in items}

    lam = by_key[("CO26092800002", "lam-don")]
    assert lam["employee_id"] == "1"
    assert lam["kind"] == "co"
    assert lam["created_at"].startswith("2026-09-28T15:02:53")

    kiem = by_key[("CO26092800002", "kiem-don")]
    assert kiem["employee_id"] == "1"
    assert kiem["created_at"].startswith("2026-09-28T14:59:39")

    other = by_key[("CO26070400817", "kiem-don")]
    assert other["employee_id"] == "1"
    assert "COERP-SKIP" not in {item["code"] for item in items}

    again = client.get("/api/orders", headers=headers).get_json()
    assert again["total"] == 3


def test_erp_replace_drops_old_co_keeps_pd(tmp_path):
    app = _app(tmp_path, CAPACITY_UPDATED_AT="v1")
    client = app.test_client()
    _assign_codes(client, 1, "PBB0099", "PBA0099")
    headers = _login(client, "1", "employee")
    listed = client.get("/api/orders", headers=headers)
    assert listed.get_json()["total"] == 3

    pd = client.post(
        "/api/orders",
        json={"codes": ["PDKEEP"], "type": "lam-don", "kind": "pd"},
        headers=headers,
    )
    assert pd.status_code == 201
    stale = client.post(
        "/api/orders",
        json={"codes": ["CO-STALE"], "type": "lam-don"},
        headers=headers,
    )
    assert stale.status_code == 201
    other = client.post(
        "/api/orders",
        json={"codes": ["LAYOUT1"], "type": "lam-layout"},
        headers=headers,
    )
    assert other.status_code == 201

    from app.capacity import ensure_capacity_synced, reset_capacity_cache

    app.config["CAPACITY_UPDATED_AT"] = "v2"
    app.config["CAPACITY_ROWS"] = [
        {
            "orderNo": "CO-NEW",
            "scanEmployeeCode": "PBB0099",
            "employeeCompletionTime": "2026-10-05 08:00:00",
        },
        {
            "orderNo": "CO26092800002",
            "scanEmployeeCode": "PBA0099",
            "employeeCompletionTime": "2026-09-28 14:59:39",
        },
    ]
    with app.app_context():
        reset_capacity_cache()
        ensure_capacity_synced(force=True)

    items = client.get("/api/orders", headers=headers).get_json()["items"]
    keys = {(item["code"], item["type"], item["kind"]) for item in items}
    assert ("CO-NEW", "lam-don", "co") in keys
    assert ("CO26092800002", "kiem-don", "co") in keys
    assert ("PDKEEP", "lam-don", "pd") in keys
    assert ("LAYOUT1", "lam-layout", "co") in keys
    assert ("CO-STALE", "lam-don", "co") not in keys
    assert ("CO26092800002", "lam-don", "co") not in keys
    assert ("CO26070400817", "kiem-don", "co") not in keys


def test_employee_lists_all_erp_orders(tmp_path):
    app = _app(tmp_path)
    client = app.test_client()
    _assign_codes(client, 1, "PBB0099", "PBA0099")

    lan = _login(client, "2", "employee")
    listed = client.get("/api/orders", headers=lan).get_json()
    assert listed["total"] == 3
    assert {item["employee_id"] for item in listed["items"]} == {"1"}

    manager = _login(client, "169", "manager")
    all_items = client.get("/api/orders", headers=manager).get_json()
    assert all_items["total"] == 3
    assert {item["employee_id"] for item in all_items["items"]} == {"1"}


def test_testing_without_capacity_rows_skips_network(tmp_path):
    app = _app(
        tmp_path,
        CAPACITY_ROWS=None,
        CAPACITY_URL="http://127.0.0.1:9/missing.json",
    )
    client = app.test_client()
    headers = _login(client)
    listed = client.get("/api/orders", headers=headers)
    assert listed.status_code == 200
    assert listed.get_json()["total"] == 0


def test_scheduler_skipped_in_testing(tmp_path):
    app = _app(tmp_path)
    assert "om_capacity_scheduler" not in app.extensions


def test_scheduler_runs_in_background(tmp_path):
    from app.capacity import stop_capacity_scheduler

    app = create_app(
        {
            "TESTING": False,
            "SECRET_KEY": "test-secret",
            "CAPACITY_ROWS": ERP_ROWS,
            "CAPACITY_INTERVAL": 3600,
            "CAPACITY_UPDATED_AT": "sched-1",
        }
    )
    try:
        sched = app.extensions.get("om_capacity_scheduler")
        assert sched is not None
        assert sched["thread"].is_alive()
    finally:
        stop_capacity_scheduler(app)

