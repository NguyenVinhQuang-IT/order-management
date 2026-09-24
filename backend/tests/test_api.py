def test_employee_roster_codes_unique():
    from app.roster import EMPLOYEE_ROSTER

    ids = [row[0] for row in EMPLOYEE_ROSTER]
    pbbs = [row[2] for row in EMPLOYEE_ROSTER if row[2]]
    pbas = [row[3] for row in EMPLOYEE_ROSTER if row[3]]
    assert len(ids) == len(set(ids))
    assert len(pbbs) == len(set(pbbs)) == 24
    assert len(pbas) == len(set(pbas)) == 21


def test_legacy_emp_table_gains_pbb_pba(tmp_path):
    import sqlite3

    from app import create_app

    db_path = tmp_path / "legacy.db"
    conn = sqlite3.connect(db_path)
    conn.execute("CREATE TABLE emp (id INTEGER PRIMARY KEY, name TEXT)")
    conn.execute("INSERT INTO emp (id, name) VALUES (1, 'Old')")
    conn.commit()
    conn.close()

    app = create_app(
        {"TESTING": True, "SECRET_KEY": "test-secret", "DATABASE": str(db_path)}
    )
    with app.app_context():
        from app.db import get_db

        cols = {row[1] for row in get_db().execute("PRAGMA table_info(emp)")}
        assert "pbb" in cols
        assert "pba" in cols


def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.get_json()["ok"] is True


def test_login_success(client):
    response = client.post(
        "/api/auth/login",
        json={"employee_id": "001", "password": "123456", "role": "employee"},
    )
    data = response.get_json()
    assert response.status_code == 200
    assert data["user"]["name"] == "Quang"
    assert data["user"]["role"] == "employee"
    assert data["token"]


def test_login_wrong_role(client):
    response = client.post(
        "/api/auth/login",
        json={"employee_id": "1", "password": "123456", "role": "manager"},
    )
    assert response.status_code == 401
    assert "vai trò" in response.get_json()["error"]


def test_login_wrong_password(client):
    response = client.post(
        "/api/auth/login",
        json={"employee_id": "1", "password": "wrong", "role": "employee"},
    )
    assert response.status_code == 401


def test_orders_require_auth(client):
    response = client.get("/api/orders")
    assert response.status_code == 401


def test_employee_creates_and_lists_own_orders(client, login):
    headers, _user = login()
    created = client.post(
        "/api/orders",
        json={"codes": ["co001", "co002"], "type": "lam-don", "note": "gấp"},
        headers=headers,
    )
    assert created.status_code == 201
    payload = created.get_json()
    assert len(payload["added"]) == 2
    assert payload["added"][0]["code"] == "CO001"
    assert payload["added"][0]["type"] == "lam-don"
    assert payload["added"][0]["kind"] == "co"

    listed = client.get("/api/orders", headers=headers)
    assert listed.status_code == 200
    assert len(listed.get_json()["items"]) == 2


def test_duplicate_order_same_process(client, login):
    headers, _user = login()
    client.post(
        "/api/orders",
        json={"codes": ["CO100"], "type": "lam-don"},
        headers=headers,
    )
    again = client.post(
        "/api/orders",
        json={"codes": ["CO100"], "type": "lam-don"},
        headers=headers,
    )
    data = again.get_json()
    assert again.status_code == 201
    assert data["added"] == []
    assert data["duplicates"] == ["CO100"]


def test_pd_order_only_on_allowed_process(client, login):
    headers, _user = login()
    rejected = client.post(
        "/api/orders",
        json={"codes": ["PD1"], "type": "luu-btw", "kind": "pd"},
        headers=headers,
    )
    assert rejected.status_code == 400

    accepted = client.post(
        "/api/orders",
        json={"codes": ["PD1"], "type": "kiem-don", "kind": "pd"},
        headers=headers,
    )
    assert accepted.status_code == 201
    assert accepted.get_json()["added"][0]["kind"] == "pd"


def test_employee_cannot_see_other_orders(client, login):
    quang, _ = login("1", "123456", "employee")
    client.post(
        "/api/orders",
        json={"codes": ["ONLY-QUANG"], "type": "lam-don"},
        headers=quang,
    )
    lan, _ = login("2", "123456", "employee")
    listed = client.get("/api/orders", headers=lan)
    assert listed.get_json()["items"] == []


def test_manager_sees_all_and_stats(client, login):
    quang, _ = login("1", "123456", "employee")
    client.post(
        "/api/orders",
        json={"codes": ["A1"], "type": "lam-don"},
        headers=quang,
    )
    manager, _ = login("169", "123456", "manager")
    listed = client.get("/api/orders", headers=manager)
    assert len(listed.get_json()["items"]) == 1
    stats = client.get("/api/stats", headers=manager)
    assert stats.status_code == 200
    data = stats.get_json()
    assert data["total"] == 1
    assert data["unique_co_codes"] == 1


def test_manager_type_seconds(client, login):
    manager, _ = login("169", "123456", "manager")
    saved = client.put(
        "/api/settings/type-seconds",
        json={"type": "lam-don", "seconds": 120},
        headers=manager,
    )
    assert saved.status_code == 200
    assert saved.get_json()["type_seconds"]["lam-don"] == 120

    quang, _ = login("1", "123456", "employee")
    created = client.post(
        "/api/orders",
        json={"codes": ["S1"], "type": "lam-don"},
        headers=quang,
    )
    assert created.get_json()["added"][0]["seconds"] == 120


def test_employee_cannot_update_seconds(client, login):
    headers, _ = login()
    created = client.post(
        "/api/orders",
        json={"codes": ["S2"], "type": "lam-don"},
        headers=headers,
    )
    order_id = created.get_json()["added"][0]["id"]
    response = client.put(
        f"/api/orders/{order_id}/seconds",
        json={"seconds": 10},
        headers=headers,
    )
    assert response.status_code == 403


def test_manager_can_create_employee(client, login):
    manager, _ = login("169", "123456", "manager")
    created = client.post(
        "/api/employees",
        json={
            "id": 10,
            "name": "Minh",
            "pbb": "PBB01",
            "pba": "PBA02",
            "role": "employee",
            "password": "abc123",
        },
        headers=manager,
    )
    assert created.status_code == 201
    body = created.get_json()
    assert body["pbb"] == "PBB01"
    assert body["pba"] == "PBA02"
    headers, user = login("10", "abc123", "employee")
    assert user["name"] == "Minh"
    assert user["pbb"] == "PBB01"
    assert user["pba"] == "PBA02"
    me = client.get("/api/auth/me", headers=headers)
    assert me.get_json()["user"]["id"] == 10

    updated = client.put(
        "/api/employees/10",
        json={"pbb": "  PBB09  ", "pba": ""},
        headers=manager,
    )
    assert updated.status_code == 200
    assert updated.get_json()["name"] == "Minh"
    assert updated.get_json()["pbb"] == "PBB09"
    assert updated.get_json()["pba"] == ""

    listed = client.get("/api/employees", headers=manager).get_json()["items"]
    minh = next(item for item in listed if item["id"] == 10)
    assert minh["pbb"] == "PBB09"
    assert minh["pba"] == ""


def test_bulk_delete_and_clear(client, login):
    headers, _ = login()
    created = client.post(
        "/api/orders",
        json={"codes": ["B1", "B2", "B3"], "type": "lam-don"},
        headers=headers,
    )
    ids = [item["id"] for item in created.get_json()["added"]]
    deleted = client.post(
        "/api/orders/delete",
        json={"ids": ids[:2]},
        headers=headers,
    )
    assert deleted.status_code == 200
    assert set(deleted.get_json()["deleted"]) == set(ids[:2])
    remaining = client.get("/api/orders", headers=headers).get_json()["items"]
    assert [item["code"] for item in remaining] == ["B3"]

    cleared = client.post("/api/orders/clear", headers=headers)
    assert cleared.status_code == 200
    assert client.get("/api/orders", headers=headers).get_json()["items"] == []


def test_search_filters_in_sql(client, login):
    headers, _ = login()
    client.post(
        "/api/orders",
        json={"codes": ["ALPHA", "BETA"], "type": "lam-don", "note": "gấp"},
        headers=headers,
    )
    found = client.get("/api/orders?q=alpha", headers=headers)
    assert [item["code"] for item in found.get_json()["items"]] == ["ALPHA"]
    noted = client.get("/api/orders?q=gấp", headers=headers)
    assert {item["code"] for item in noted.get_json()["items"]} == {"ALPHA", "BETA"}


def test_processes_seeded(client, login):
    headers, _ = login("169", "123456", "manager")
    response = client.get("/api/processes", headers=headers)
    items = response.get_json()["items"]
    slugs = {item["slug"] for item in items}
    assert "lam-don" in slugs
    assert "don-loi" in slugs
    assert len(items) == 19
