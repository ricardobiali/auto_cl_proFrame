# app/services/file_io.py
from __future__ import annotations
import json
import os
from pathlib import Path
from typing import Any, Dict

DEFAULT_REQUESTS: Dict[str, Any] = {"paths": [], "requests": [], "status": [{}], "destino": []}

def load_json(path: Path, default: Dict[str, Any] | None = None) -> Dict[str, Any]:
    if default is None:
        default = DEFAULT_REQUESTS
    try:
        if path.exists():
            with path.open("r", encoding="utf-8") as f:
                return json.load(f)
    except Exception:
        # se estiver corrompido, cai pro default
        pass
    return dict(default)

def save_json_atomic(path: Path, data: Dict[str, Any]) -> None:
    """
    Escrita atômica: escreve em .tmp e faz replace.
    Evita requests.json corrompido caso o app feche no meio.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=4, ensure_ascii=False)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, path)

def ensure_destino_list(data: Dict[str, Any]) -> None:
    """
    Garante que data['destino'] seja uma lista e tenha ao menos um dict
    (compatibilidade com sua lógica atual que usa destino[0]).
    """
    if "destino" not in data or not isinstance(data["destino"], list):
        data["destino"] = []
    if not data["destino"]:
        data["destino"].append({})

def set_status(data: Dict[str, Any], key: str, value: str) -> None:
    if "status" not in data or not isinstance(data["status"], list) or not data["status"]:
        data["status"] = [{}]
    if not isinstance(data["status"][0], dict):
        data["status"][0] = {}
    data["status"][0][key] = value