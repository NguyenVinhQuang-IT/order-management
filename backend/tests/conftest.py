import pytest

from app import create_app


@pytest.fixture
def app(tmp_path):
    application = create_app(
        {
            "TESTING": True,
            "SECRET_KEY": "test-secret",
            "DATABASE": str(tmp_path / "test.db"),
        }
    )
    yield application


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def login(client):
    def _login(employee_id="1", password="123456", role="employee"):
        response = client.post(
            "/api/auth/login",
            json={"employee_id": employee_id, "password": password, "role": role},
        )
        payload = response.get_json()
        token = payload["token"]
        return {"Authorization": f"Bearer {token}"}, payload["user"]

    return _login
