# app/state.py
from __future__ import annotations

from dataclasses import dataclass, asdict, field
from threading import Event, Lock
from typing import Optional, List
import subprocess


@dataclass
class JobStatus:
    running: bool = False
    success: Optional[bool] = None
    message: str = ""
    logs: List[str] = field(default_factory=list)  # ✅ NOVO: logs/progresso


class JobState:
    """
    Estado global do app, thread-safe:
    - status do job (running/success/message)
    - logs de progresso (para exibir no frontend)
    - token de cancelamento
    - lista de subprocessos iniciados pelo app
    """

    def __init__(self) -> None:
        self._lock = Lock()
        self._cancel_event = Event()
        self._status = JobStatus()
        self._procs: List[subprocess.Popen] = []

    # -------- status --------
    def snapshot(self) -> dict:
        with self._lock:
            return asdict(self._status)

    def is_running(self) -> bool:
        with self._lock:
            return self._status.running

    def set_running(self, message: str = "Executando automação...", *, clear_logs: bool = True) -> None:
        with self._lock:
            self._cancel_event.clear()
            self._status.running = True
            self._status.success = None
            self._status.message = message
            if clear_logs:
                self._status.logs.clear()

    def set_done(self, success: bool, message: str) -> None:
        with self._lock:
            self._status.running = False
            self._status.success = success
            self._status.message = message

    def set_message(self, message: str) -> None:
        with self._lock:
            self._status.message = message

    # -------- logs/progresso --------
    def append_log(self, line: str, *, max_lines: int = 300) -> None:
        """
        Adiciona uma linha de log/progresso para ser exibida no frontend.
        Mantém apenas as últimas max_lines linhas.
        """
        line = (line or "").strip()
        if not line:
            return
        with self._lock:
            self._status.logs.append(line)
            if len(self._status.logs) > max_lines:
                self._status.logs = self._status.logs[-max_lines:]

    def clear_logs(self) -> None:
        with self._lock:
            self._status.logs.clear()

    def set_logs(self, lines: List[str], *, max_lines: int = 300) -> None:
        with self._lock:
            self._status.logs = list(lines)[-max_lines:]

    # -------- cancelamento --------
    def request_cancel(self) -> None:
        self._cancel_event.set()

    def cancel_requested(self) -> bool:
        return self._cancel_event.is_set()

    # -------- subprocessos --------
    def register_proc(self, proc: subprocess.Popen) -> None:
        with self._lock:
            self._procs.append(proc)

    def terminate_children(self) -> None:
        """
        Encerra apenas subprocessos iniciados pelo app.
        """
        with self._lock:
            procs = list(self._procs)
            self._procs.clear()

        for p in procs:
            try:
                if p and p.poll() is None:
                    p.terminate()
            except Exception:
                pass

    def clear_children(self) -> None:
        with self._lock:
            self._procs.clear()
