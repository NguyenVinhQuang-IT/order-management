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
        json={"id": 10, "name": "Minh", "role": "employee", "password": "abc123"},
        headers=manager,
    )
    assert created.status_code == 201
    headers, user = login("10", "abc123", "employee")
    assert user["name"] == "Minh"
    me = client.get("/api/auth/me", headers=headers)
    assert me.get_json()["user"]["id"] == 10


def test_processes_seeded(client, login):
    headers, _ = login("169", "123456", "manager")
    response = client.get("/api/processes", headers=headers)
    items = response.get_json()["items"]
    slugs = {item["slug"] for item in items}
    assert "lam-don" in slugs
    assert "don-loi" in slugs
    assert len(items) == 19
