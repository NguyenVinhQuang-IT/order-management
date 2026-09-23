import os
from pathlib import Path

from flask import Flask, jsonify
from flask.json.provider import DefaultJSONProvider
from flask_cors import CORS

from .api import bp as api_bp, register_error_handlers
from .db import close_db, init_schema
from .seed import seed_if_empty


class UTF8JSONProvider(DefaultJSONProvider):
    ensure_ascii = False


def create_app(test_config=None):
    app = Flask(__name__)
    root = Path(__file__).resolve().parent.parent
    app.json = UTF8JSONProvider(app)
    app.config.from_mapping(
        SECRET_KEY=os.environ.get("SECRET_KEY", "dev-secret-change-me"),
        DATABASE=os.environ.get("DATABASE", str(root / "data" / "order-management.db")),
    )
    if test_config:
        app.config.update(test_config)

    Path(app.config["DATABASE"]).parent.mkdir(parents=True, exist_ok=True)

    CORS(
        app,
        resources={
            r"/api/*": {
                "origins": [
                    "http://localhost:5173",
                    "http://127.0.0.1:5173",
                ]
            }
        },
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization"],
    )

    app.teardown_appcontext(close_db)
    app.register_blueprint(api_bp)
    register_error_handlers(app)

    @app.get("/")
    def root():
        return jsonify({"service": "order-management", "api": "/api/health"})

    with app.app_context():
        init_schema()
        seed_if_empty()

    return app
