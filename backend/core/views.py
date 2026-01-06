# backend/core/views.py
from __future__ import annotations

import csv
import getpass
import os
import time
from pathlib import Path
from typing import Optional, Tuple

from django.http import JsonResponse
from django.views.decorators.http import require_GET


def _core_root() -> Path:
    return Path(__file__).resolve().parent


def _read_user_from_csv(login: str, csv_path: Path) -> Tuple[Optional[str], Optional[str]]:
    """
    CSV no formato (delimiter ';'):
      chave;gender;nome
      u33v;m;Ricardo Biali
    """
    if not csv_path.exists():
        return None, None

    login_norm = (login or "").strip().lower()

    # utf-8-sig: aguenta BOM do Excel
    with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f, delimiter=";")
        for row in reader:
            chave = (row.get("chave") or "").strip().lower()
            if chave != login_norm:
                continue

            gender = (row.get("gender") or "").strip().lower()
            nome = (row.get("nome") or "").strip()

            if gender not in ("m", "f"):
                gender = "m"
            if not nome:
                nome = login

            return nome, gender

    return None, None


def _resolve_login(request) -> str:
    return (
        request.GET.get("login")
        or os.environ.get("USERNAME")
        or os.environ.get("USER")
        or getpass.getuser()
        or ""
    ).strip()


@require_GET
def welcome(request):
    login = _resolve_login(request)

    csv_path = _core_root() / "user_data.csv"
    name, gender = _read_user_from_csv(login, csv_path)

    if not name:
        name = login
    if gender not in ("m", "f"):
        gender = "m"

    # você monta a frase no React, mas se quiser já mandar pronta:
    greeting = ("Seja bem-vinda" if gender == "f" else "Seja bem-vindo") + f", {name}!"

    return JsonResponse(
        {"ok": True, "login": login, "name": name, "gender": gender, "greeting": greeting}
    )


@require_GET
def health(_request):
    # simples e confiável pro Tauri aguardar
    return JsonResponse(
        {
            "ok": True,
            "service": "backend",
            "ts": time.time(),
        }
    )