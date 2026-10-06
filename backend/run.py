import argparse
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def _venv_python():
    if os.name == "nt":
        return ROOT / ".venv" / "Scripts" / "python.exe"
    return ROOT / ".venv" / "bin" / "python"


def _has_runtime():
    try:
        import flask  # noqa: F401
        import psycopg  # noqa: F401
        import waitress  # noqa: F401
        return True
    except ImportError:
        return False


def _ensure_runtime():
    if _has_runtime():
        return
    python = _venv_python()
    venv_dir = ROOT / ".venv"
    requirements = ROOT / "requirements.txt"
    if not python.exists():
        import venv

        print("Chua co .venv — dang tao va cai dat phu thuoc...")
        venv.create(venv_dir, with_pip=True)
        subprocess.check_call(
            [str(python), "-m", "pip", "install", "-r", str(requirements)]
        )
    if Path(sys.executable).resolve() != python.resolve():
        raise SystemExit(subprocess.call([str(python), str(Path(__file__).resolve()), *sys.argv[1:]]))
    if not _has_runtime():
        subprocess.check_call(
            [str(python), "-m", "pip", "install", "-r", str(requirements)]
        )


_ensure_runtime()

from app.db import format_db_target, load_env_files  # noqa: E402

load_env_files()

from app import create_app  # noqa: E402

app = create_app()


def _parse_args(argv):
    parser = argparse.ArgumentParser(description="Order Management API")
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Chay Werkzeug development server (khong dung production)",
    )
    parser.add_argument(
        "--host",
        default=os.environ.get("HOST", "127.0.0.1"),
    )
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.environ.get("PORT", "5000")),
    )
    return parser.parse_args(argv)


def main(argv=None):
    args = _parse_args(sys.argv[1:] if argv is None else argv)
    origin = f"http://{args.host}:{args.port}"
    print(f"Python: {sys.executable}")
    print(f"Moi truong: {'development' if args.debug else 'production'}")
    print(f"PostgreSQL: {format_db_target(app.config['DATABASE'])}")
    print(f"API: {origin}/api/health")
    if (ROOT.parent / "dist" / "index.html").is_file():
        print(f"Web: {origin}")

    if args.debug:
        app.run(host=args.host, port=args.port, debug=True, use_reloader=False)
        return

    from waitress import serve

    print("WSGI: waitress")
    serve(
        app,
        host=args.host,
        port=args.port,
        threads=8,
        ident="order-management",
        channel_timeout=120,
    )


if __name__ == "__main__":
    main()
