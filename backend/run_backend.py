from __future__ import annotations

import os
import sys
from pathlib import Path


def _add_manage_py_to_syspath() -> None:
    """
    Ajuste automático do sys.path para achar o manage.py e os módulos do projeto.
    Cenários comuns:
      - manage.py está em backend/manage.py
      - manage.py está na raiz do repo
    """
    here = Path(__file__).resolve()  # ...\backend\run_backend.py
    backend_dir = here.parent         # ...\backend
    repo_root = backend_dir.parent    # ...\ (raiz do repo)

    # tenta backend/ primeiro (muito comum)
    if (backend_dir / "manage.py").exists():
        if str(backend_dir) not in sys.path:
            sys.path.insert(0, str(backend_dir))
        return

    # fallback: repo root
    if (repo_root / "manage.py").exists():
        if str(repo_root) not in sys.path:
            sys.path.insert(0, str(repo_root))
        return

    # último fallback: coloca backend mesmo assim
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))


def main() -> int:
    _add_manage_py_to_syspath()

    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "server.settings")

    from django.core.management import execute_from_command_line

    host = os.environ.get("AUTOCL_HOST", "127.0.0.1")
    port = os.environ.get("AUTOCL_PORT", "8000")

    # IMPORTANTÍSSIMO para exe:
    # --noreload evita o Django spawnar outro processo (quebra no PyInstaller)
    argv = ["manage.py", "runserver", f"{host}:{port}", "--noreload"]
    execute_from_command_line(argv)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())