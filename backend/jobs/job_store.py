# backend/jobs/job_store.py
from __future__ import annotations

import time
from pathlib import Path
from typing import Any, Dict, Optional

from jobs.services.file_io import save_json_atomic, load_json


def _backend_root() -> Path:
    # este arquivo está em backend/jobs/job_store.py
    return Path(__file__).resolve().parents[1]  # .../backend


def _jobs_dir() -> Path:
    d = _backend_root() / "data" / "jobs"
    d.mkdir(parents=True, exist_ok=True)
    return d


def job_state_path(job_id: str) -> Path:
    return _jobs_dir() / f"{job_id}.json"


def save_job_state(job: Any) -> None:
    """
    Persiste estado mínimo do job em JSON.
    Aceita JobRuntime (do views.py).
    """
    payload: Dict[str, Any] = {
        "job_id": getattr(job, "job_id", ""),
        "job_type": getattr(job, "job_type", ""),
        "status": getattr(job, "status", ""),
        "message": getattr(job, "message", ""),
        "error": getattr(job, "error", None),
        "created_at": getattr(job, "created_at", None),
        "finished_at": getattr(job, "finished_at", None),
        "updated_at": time.time(),
    }
    save_json_atomic(job_state_path(payload["job_id"]), payload)


def load_job_state(job_id: str) -> Optional[Dict[str, Any]]:
    """
    Lê estado do job do JSON. Retorna None se não existir.
    """
    p = job_state_path(job_id)
    if not p.exists():
        return None
    data = load_json(p)
    if not isinstance(data, dict):
        return None
    return data