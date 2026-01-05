# app/services/subprocess_runner.py
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Optional, List, Union, Tuple

import os
import subprocess
import threading
import queue
import sys


LineCallback = Callable[[str], None]


@dataclass
class Completed:
    stdout: str
    stderr: str
    returncode: int


def _is_frozen() -> bool:
    return bool(getattr(sys, "frozen", False))


def build_python_cmd(script_path: Union[str, Path], args: Optional[List[str]] = None) -> List[str]:
    """
    DEV:   [python, -u, script.py, ...args]
    FROZEN:[AUTO_CL.exe, --run, <script_name>, ...args]

    Observação:
    - No PyInstaller NÃO existe python.exe separado; o runner deve chamar o próprio exe.
    - Você precisa implementar no app/main_app.py o "dispatch" do argumento --run.
    """
    args = args or []

    sp = Path(script_path)
    script_name = sp.stem  # reduzida.py -> "reduzida"

    if _is_frozen():
        exe = sys.executable  # caminho do AUTO_CL.exe
        return [exe, "--run", script_name, *args]

    # DEV
    py = sys.executable
    return [py, "-u", str(sp), *args]


def run_capture(
    cmd: List[str],
    creationflags: int = 0,
    timeout: Optional[float] = None,
) -> Completed:
    r = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        creationflags=creationflags,
        timeout=timeout,
    )
    return Completed(stdout=r.stdout or "", stderr=r.stderr or "", returncode=r.returncode)


def spawn_stream(
    cmd: List[str],
    on_line: Optional[LineCallback] = None,
    creationflags: int = 0,
    cancel_check: Optional[Callable[[], bool]] = None,
    register_proc: Optional[Callable[[subprocess.Popen], None]] = None,
    poll_interval: float = 0.05,
) -> Tuple[int, str]:
    proc = subprocess.Popen(
        cmd,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        creationflags=creationflags,
        bufsize=1,
        universal_newlines=True,
    )

    if register_proc:
        try:
            register_proc(proc)
        except Exception:
            pass

    q: "queue.Queue[Optional[str]]" = queue.Queue()
    stdout_chunks: List[str] = []

    def _reader():
        try:
            if proc.stdout is None:
                q.put(None)
                return
            for line in proc.stdout:
                q.put(line)
        finally:
            q.put(None)

    t = threading.Thread(target=_reader, daemon=True)
    t.start()

    done = False
    while not done:
        if cancel_check and cancel_check():
            try:
                proc.terminate()
            except Exception:
                pass

        try:
            item = q.get(timeout=poll_interval)
        except queue.Empty:
            if proc.poll() is not None:
                continue
            continue

        if item is None:
            done = True
            break

        stdout_chunks.append(item)
        if on_line:
            try:
                on_line(item.rstrip("\n"))
            except Exception:
                pass

    try:
        proc.wait(timeout=5)
    except Exception:
        try:
            proc.kill()
        except Exception:
            pass

    returncode = proc.returncode if proc.returncode is not None else -1
    stdout_total = "".join(stdout_chunks)
    return returncode, stdout_total
