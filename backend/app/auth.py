from functools import wraps

from flask import current_app, g, jsonify, request
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from werkzeug.security import check_password_hash, generate_password_hash

from .constants import TOKEN_MAX_AGE


def hash_password(password):
    return generate_password_hash(password)


def verify_password(password_hash, password):
    if not password_hash or password is None:
        return False
    return check_password_hash(password_hash, str(password))


def _serializer():
    cached = current_app.extensions.get("om_serializer")
    if cached is None:
        cached = URLSafeTimedSerializer(current_app.config["SECRET_KEY"], salt="om-auth")
        current_app.extensions["om_serializer"] = cached
    return cached


def create_token(payload):
    return _serializer().dumps(payload)


def load_token(token):
    try:
        return _serializer().loads(token, max_age=TOKEN_MAX_AGE)
    except (BadSignature, SignatureExpired, TypeError):
        return None


def _extract_token():
    header = request.headers.get("Authorization", "")
    if header.startswith("Bearer "):
        return header[7:].strip()
    return request.cookies.get("om_token")


def get_current_user():
    if "current_user" in g:
        return g.current_user

    token = _extract_token()
    payload = load_token(token) if token else None
    if not payload or "id" not in payload:
        g.current_user = None
        return None

    from .db import get_db

    row = get_db().execute(
        "SELECT id, name FROM emp WHERE id = ?",
        (payload["id"],),
    ).fetchone()
    if not row:
        g.current_user = None
        return None

    g.current_user = {
        "id": row["id"],
        "employee_id": str(row["id"]),
        "name": row["name"],
        "role": payload.get("role") or "employee",
    }
    return g.current_user


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({"error": "Cần đăng nhập."}), 401
        return fn(*args, **kwargs)

    return wrapper


def manager_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({"error": "Cần đăng nhập."}), 401
        if user.get("role") != "manager":
            return jsonify({"error": "Chỉ quản lý mới thực hiện được thao tác này."}), 403
        return fn(*args, **kwargs)

    return wrapper
