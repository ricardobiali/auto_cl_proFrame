# app/hook_logging.py
from __future__ import annotations

import logging
from logging.handlers import RotatingFileHandler
import sys
import threading
from pathlib import Path

from app.paths import Paths


def _choose_log_file() -> Path:
    """
    Prioridade:
    1) Pasta do executável (raiz do app) -> auto_cl.log
    2) Fallback: AppData\\AUTO_CL\\logs\\auto_cl.log
    """
    # 1) raiz do app (onde está o .exe)
    if getattr(sys, "frozen", False):
        app_root = Path(sys.executable).parent
    else:
        # em dev, usa raiz do projeto (ajuste se preferir outro local)
        app_root = Path(__file__).resolve().parents[1]

    preferred = app_root / "auto_cl.log"

    # testa se consegue criar/append
    try:
        preferred.parent.mkdir(parents=True, exist_ok=True)
        with open(preferred, "a", encoding="utf-8"):
            pass
        return preferred
    except Exception:
        # 2) fallback AppData
        P = Paths.build()
        fallback = P.logs / "auto_cl.log"
        fallback.parent.mkdir(parents=True, exist_ok=True)
        return fallback


def setup_logging(level: int = logging.INFO) -> None:
    """
    Logging robusto:
    - Preferência: arquivo na raiz do app (auto_cl.log ao lado do .exe)
    - Fallback: AppData\\...\\logs\\auto_cl.log se não tiver permissão
    - rotação (2MB, 5 backups)
    - thread excepthook
    """
    log_file = _choose_log_file()

    # raiz
    root = logging.getLogger()
    root.setLevel(level)

    # evita duplicar handlers se chamar duas vezes
    for h in list(root.handlers):
        root.removeHandler(h)

    fmt = logging.Formatter(
        fmt="%(asctime)s %(levelname)s %(name)s [%(process)d %(threadName)s] - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    file_handler = RotatingFileHandler(
        filename=str(log_file),
        mode="a",
        maxBytes=2 * 1024 * 1024,  # 2MB
        backupCount=5,
        encoding="utf-8",
    )
    file_handler.setLevel(level)
    file_handler.setFormatter(fmt)
    root.addHandler(file_handler)

    # console em DEV (opcional)
    if not getattr(sys, "frozen", False):
        console = logging.StreamHandler()
        console.setLevel(level)
        console.setFormatter(fmt)
        root.addHandler(console)

    # Exceções não tratadas em threads (Python 3.8+)
    def _thread_excepthook(args):
        logging.getLogger("thread").exception(
            "Exceção não tratada em thread",
            exc_info=(args.exc_type, args.exc_value, args.exc_traceback),
        )

    try:
        threading.excepthook = _thread_excepthook  # type: ignore[attr-defined]
    except Exception:
        pass

    logging.getLogger(__name__).info("Logging inicializado: %s", log_file)
    # dica extra: se você quiser, pode também printar isso pra aparecer no seu console/avisos:
    # print(f"[LOG] {log_file}")
