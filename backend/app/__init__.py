import os
import secrets
from pathlib import Path

from flask import Flask, jsonify, send_from_directory
from flask.json.provider import DefaultJSONProvider
from flask_cors import CORS

from .api import bp as api_bp, register_error_handlers
from .db import close_db, init_schema
from .seed import seed_if_empty


class UTF8JSONProvider(DefaultJSONProvider):
    ensure_ascii = False


CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5000",
    "http://127.0.0.1:5000",
]


def _resolve_secret_key(root: Path) -> str:
    env = os.environ.get("SECRET_KEY")
    if env:
        return env
    path = root / "data" / "secret_key"
    if path.exists():
        value = path.read_text(encoding="utf-8").strip()
        if value:
            return value
    value = secrets.token_hex(32)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(value, encoding="utf-8")
    return value


def _register_frontend(app, dist_dir: Path):
    if not (dist_dir / "index.html").is_file():
        @app.get("/")
        def root():
            return jsonify({"service": "order-management", "api": "/api/health"})

        return

    @app.get("/")
    @app.get("/<path:path>")
    def frontend(path=""):
        if path == "api" or path.startswith("api/"):
            return jsonify({"error": "Not found"}), 404
        if path:
            candidate = dist_dir / path
            if candidate.is_file():
                return send_from_directory(dist_dir, path)
        return send_from_directory(dist_dir, "index.html")


def create_app(test_config=None):
    app = Flask(__name__)
    root = Path(__file__).resolve().parent.parent
    dist_dir = root.parent / "dist"
    app.json = UTF8JSONProvider(app)
    try:
        capacity_interval = int(os.environ.get("CAPACITY_INTERVAL") or os.environ.get("CAPACITY_TTL", "7200"))
    except ValueError:
        capacity_interval = 7200
    config = {
        "SECRET_KEY": os.environ.get("SECRET_KEY") or "dev-secret-change-me",
        "DATABASE": os.environ.get("DATABASE", str(root / "data" / "order-management.db")),
        "DEBUG": False,
        "CAPACITY_URL": os.environ.get(
            "CAPACITY_URL",
            "http://192.168.101.65:8088/data/xep-ban-capacity.json",
        ),
        "CAPACITY_INTERVAL": capacity_interval,
        "CAPACITY_TTL": capacity_interval,
    }
    if test_config:
        config.update(test_config)
    else:
        config["SECRET_KEY"] = _resolve_secret_key(root)
    app.config.from_mapping(config)

    Path(app.config["DATABASE"]).parent.mkdir(parents=True, exist_ok=True)

    extra_origins = [
        origin.strip()
        for origin in os.environ.get("CORS_ORIGINS", "").split(",")
        if origin.strip()
    ]
    CORS(
        app,
        resources={
            r"/api/*": {
                "origins": CORS_ORIGINS + extra_origins,
            }
        },
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization"],
    )

    app.teardown_appcontext(close_db)
    app.register_blueprint(api_bp)
    register_error_handlers(app)
    _register_frontend(app, dist_dir)

    with app.app_context():
        init_schema()
        seed_if_empty()

    from .capacity import start_capacity_scheduler

    start_capacity_scheduler(app)
    return app
