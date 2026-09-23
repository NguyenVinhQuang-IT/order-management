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


def _has_flask():
    try:
        import flask  # noqa: F401
        return True
    except ImportError:
        return False


def _ensure_flask():
    if _has_flask():
        return
    python = _venv_python()
    venv_dir = ROOT / ".venv"
    requirements = ROOT / "requirements.txt"
    if not python.exists():
        import venv

        print("Chua co .venv — dang tao va cai dat Flask...")
        venv.create(venv_dir, with_pip=True)
        subprocess.check_call(
            [str(python), "-m", "pip", "install", "-r", str(requirements)]
        )
    if Path(sys.executable).resolve() != python.resolve():
        raise SystemExit(subprocess.call([str(python), str(Path(__file__).resolve()), *sys.argv[1:]]))
    if not _has_flask():
        subprocess.check_call(
            [str(python), "-m", "pip", "install", "-r", str(requirements)]
        )


_ensure_flask()

from app import create_app  # noqa: E402

app = create_app()

if __name__ == "__main__":
    print(f"Python: {sys.executable}")
    print("API: http://127.0.0.1:5000/api/health")
    app.run(host="127.0.0.1", port=5000, debug=True, use_reloader=False)
