# backend/core/paths.py
from __future__ import annotations
import os
import sys
from dataclasses import dataclass
from pathlib import Path

APP_NAME = "AUTO_CL"  # pasta em %LOCALAPPDATA%

def is_frozen() -> bool:
    """True quando rodando empacotado (PyInstaller)."""
    return bool(getattr(sys, "frozen", False))

def project_root() -> Path:
    """
    Raiz do projeto em DEV (onde está main_app.py / app/ / backend/ / frontend/).
    No bundle, isso vira a pasta sys._MEIPASS (conteúdo extraído).
    """
    if is_frozen():
        return Path(sys._MEIPASS)  # type: ignore[attr-defined]
    # __file__ = .../app/paths.py -> sobe para raiz do repo
    return Path(__file__).resolve().parent.parent

def frontend_dir() -> Path:
    """Pasta do frontend (html/css/js)."""
    # No seu repo, frontend fica na raiz
    return project_root() / "frontend"

def backend_dir() -> Path:
    """Pasta do backend (scripts SAP e reports)."""
    return project_root() / "backend"

def resources_dir() -> Path:
    """
    (Opcional) Pasta para recursos adicionais (ícones etc.), se você criar.
    """
    return project_root() / "resources"

def local_appdata_dir() -> Path:
    """
    %LOCALAPPDATA%\\AUTO_CL   (preferível em apps corporativos)
    Se LOCALAPPDATA não existir (raríssimo), cai para ~/.auto_cl
    """
    base = os.environ.get("LOCALAPPDATA")
    if base:
        return Path(base) / APP_NAME
    # fallback
    return Path.home() / f".{APP_NAME.lower()}"

def ensure_dir(p: Path) -> Path:
    p.mkdir(parents=True, exist_ok=True)
    return p

def logs_dir() -> Path:
    return ensure_dir(local_appdata_dir() / "logs")

def runs_dir() -> Path:
    return ensure_dir(local_appdata_dir() / "runs")

def config_dir() -> Path:
    return ensure_dir(local_appdata_dir() / "config")

def requests_json_path() -> Path:
    """
    requests.json NÃO deve ficar dentro do frontend no exe.
    Centralizamos em AppData.
    """
    return local_appdata_dir() / "requests.json"

def user_data_path() -> Path:
    """
    Se você mantiver user_data.csv, o ideal é mover para AppData também.
    """
    return local_appdata_dir() / "user_data.csv"

def resolve_in_bundle(path_in_repo: Path) -> Path:
    """
    Se você tiver um Path para um arquivo no repo (DEV),
    no PyInstaller você pode precisar apontar para o arquivo dentro do bundle.
    Aqui a gente resolve relativo à raiz do projeto e busca em sys._MEIPASS.
    """
    if not is_frozen():
        return path_in_repo

    root = project_root()
    try:
        rel = path_in_repo.resolve().relative_to(Path(__file__).resolve().parent.parent)
    except Exception:
        # Se não conseguiu relativizar, tenta usar a parte final
        rel = path_in_repo.name

    candidate = root / rel
    return candidate if candidate.exists() else path_in_repo

@dataclass(frozen=True)
class Paths:
    """
    Um objeto conveniente para passar pelos módulos.
    """
    root: Path
    frontend: Path
    backend: Path
    appdata: Path
    logs: Path
    runs: Path
    requests_json: Path

    @staticmethod
    def build() -> "Paths":
        root = project_root()
        appdata = ensure_dir(local_appdata_dir())
        return Paths(
            root=root,
            frontend=frontend_dir(),
            backend=backend_dir(),
            appdata=appdata,
            logs=logs_dir(),
            runs=runs_dir(),
            requests_json=requests_json_path(),
        )
