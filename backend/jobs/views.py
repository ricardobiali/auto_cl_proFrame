# backend/jobs/views.py
from __future__ import annotations

import json
import os
import queue
import threading
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Optional, List

from django.http import JsonResponse, StreamingHttpResponse, HttpResponseNotAllowed
from django.views.decorators.csrf import csrf_exempt

from jobs.services.job_runner import JobRunner
from jobs.services.state import JobState


# =========================
# Job runtime (in-memory)
# =========================

@dataclass
class JobRuntime:
    job_id: str
    job_type: str
    status: str = "queued"  # queued|running|success|error|canceled
    message: str = ""
    cancel_event: threading.Event = field(default_factory=threading.Event)
    q: "queue.Queue[dict]" = field(default_factory=queue.Queue)
    created_at: float = field(default_factory=time.time)
    finished_at: Optional[float] = None
    error: Optional[str] = None


# store global (protótipo)
JOBS: Dict[str, JobRuntime] = {}
JOBS_LOCK = threading.Lock()


def _emit(job: JobRuntime, event: str, data: Any) -> None:
    """
    Enfileira um evento pro SSE.
    """
    payload = {"event": event, "data": data, "ts": time.time()}
    job.q.put(payload)


def _get_job(job_id: str) -> Optional[JobRuntime]:
    with JOBS_LOCK:
        return JOBS.get(job_id)


# =========================
# JobState -> SSE adapter
# =========================

class SSEJobState(JobState):
    """
    Adapter do JobState que espelha eventos para SSE:
      - set_message -> event: status
      - append_log  -> event: log
      - set_done    -> event: status + done
    """

    def __init__(self, job: JobRuntime):
        super().__init__()
        self._job = job

    def set_running(self, message: str = "Executando automação...", *, clear_logs: bool = True) -> None:
        super().set_running(message, clear_logs=clear_logs)
        _emit(self._job, "status", {"status": "running", "message": message})

    def set_message(self, message: str) -> None:
        super().set_message(message)
        _emit(self._job, "status", {"status": "running", "message": message})

    def append_log(self, line: str, *, max_lines: int = 300) -> None:
        super().append_log(line, max_lines=max_lines)
        line = (line or "").strip()
        if line:
            _emit(self._job, "log", line)

    def set_done(self, success: bool, message: str) -> None:
        super().set_done(success, message)
        final_status = "success" if success else "error"
        _emit(self._job, "status", {"status": final_status, "message": message, "error": None})
        _emit(self._job, "done", {"status": final_status})


# =========================
# Worker (real) -> JobRunner
# =========================

def _run_job_worker(job: JobRuntime, payload: dict) -> None:
    """
    Worker em thread:
      - cria JobRunner
      - executa run_sequence
      - stream de logs/status via SSEJobState
    """
    try:
        job.status = "running"
        job.message = "Iniciando job..."
        _emit(job, "status", {"status": job.status, "message": job.message, "job_type": job.job_type})

        # -----------------------------------------
        # Resolve paths do projeto a partir deste file
        # views.py está em backend/jobs/views.py
        # -----------------------------------------
        backend_root = Path(__file__).resolve().parents[1]  # .../backend
        # Ajuste os caminhos abaixo se suas pastas diferirem
        sap_script = backend_root / "sap_manager" / "ysclnrcl_job.py"
        completa_script = backend_root / "reports" / "completa_xl.py"
        reduzida_script = backend_root / "reports" / "reduzida.py"

        # requests.json (por job, para não conflitar)
        data_dir = backend_root / "data"
        data_dir.mkdir(parents=True, exist_ok=True)
        requests_path = data_dir / f"requests_{job.job_id}.json"

        # switches
        job_type = str(payload.get("type") or job.job_type or "sap").strip().lower()
        switches = {
            "report_SAP": job_type in ("sap", "sequencia", "full"),
            "completa": job_type in ("completa", "sequencia", "full"),
            "reduzida": job_type in ("reduzida", "sequencia", "full"),
        }

        # paths do frontend (quando existir)
        paths = payload.get("paths") or {}
        if not isinstance(paths, dict):
            paths = {}

        # no backend não tem "file picker"; então aceitamos `payload.files`
        def selecionar_arquivo_cb() -> List[str]:
            files = payload.get("files") or []
            if isinstance(files, str):
                return [files]
            if isinstance(files, list):
                return [str(x) for x in files]
            return []

        # state com SSE
        state = SSEJobState(job)

        # espelha cancelamento (cancel_job -> state.request_cancel)
        def mirror_cancel():
            while job.finished_at is None and not job.cancel_event.is_set():
                time.sleep(0.2)
            if job.cancel_event.is_set():
                state.request_cancel()

        threading.Thread(target=mirror_cancel, daemon=True).start()

        # runner
        runner = JobRunner(
            state=state,
            requests_path=requests_path,
            sap_script=sap_script,
            completa_script=completa_script,
            reduzida_script=reduzida_script,
            creationflags=0,  # mac/linux
        )

        runner.run_sequence(
            switches=switches,
            paths=paths,
            selecionar_arquivo_cb=selecionar_arquivo_cb,
        )

        # snapshot final (espelha no runtime também)
        snap = state.snapshot()
        success = snap.get("success", None)
        if success is True:
            job.status = "success"
        elif success is False:
            job.status = "error"
        job.message = snap.get("message") or job.message
        job.finished_at = time.time()

    except Exception as e:
        _emit(job, "log", f"Erro: {e}")
        job.status = "error"
        job.message = "Falha na execução."
        job.error = str(e)
        job.finished_at = time.time()
        _emit(job, "status", {"status": job.status, "message": job.message, "error": job.error})
        _emit(job, "done", {"status": job.status})


# =========================
# API
# =========================

@csrf_exempt
def start_job(request):
    if request.method != "POST":
        return HttpResponseNotAllowed(["POST"])

    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except Exception:
        payload = {}

    job_type = str(payload.get("type", "sap")).strip() or "sap"
    job_id = str(uuid.uuid4())

    job = JobRuntime(job_id=job_id, job_type=job_type, status="queued", message="Na fila...")

    with JOBS_LOCK:
        JOBS[job_id] = job

    _emit(job, "status", {"status": job.status, "message": job.message, "job_type": job.job_type})

    t = threading.Thread(target=_run_job_worker, args=(job, payload), daemon=True)
    t.start()

    return JsonResponse({"ok": True, "job_id": job_id})


@csrf_exempt
def cancel_job(request, job_id: str):
    if request.method != "POST":
        return HttpResponseNotAllowed(["POST"])

    job = _get_job(job_id)
    if not job:
        return JsonResponse({"ok": False, "error": "job_not_found"}, status=404)

    job.cancel_event.set()
    _emit(job, "status", {"status": job.status, "message": "Cancelamento solicitado..."})

    return JsonResponse({"ok": True, "job_id": job_id})


def stream_job(request, job_id: str):
    """
    SSE: text/event-stream
    Envia:
      event: status / log / done / ping / hello
      data: JSON
    """
    job = _get_job(job_id)
    if not job:
        return JsonResponse({"ok": False, "error": "job_not_found"}, status=404)

    def sse_pack(event_name: str, data_obj: Any) -> str:
        return f"event: {event_name}\ndata: {json.dumps(data_obj, ensure_ascii=False)}\n\n"

    def event_stream():
        # handshake
        yield sse_pack("hello", {"job_id": job.job_id, "status": job.status, "message": job.message})

        last_ping = time.time()

        while True:
            # termina quando o job acabou e a fila ficou vazia
            if job.finished_at is not None and job.q.empty():
                # garante um done final (caso algum cliente conecte tarde)
                yield sse_pack("done", {"status": job.status})
                return

            try:
                item = job.q.get(timeout=0.5)
                yield sse_pack(item["event"], item["data"])
            except queue.Empty:
                if time.time() - last_ping > 10:
                    last_ping = time.time()
                    yield sse_pack("ping", {"t": last_ping})

    resp = StreamingHttpResponse(event_stream(), content_type="text/event-stream; charset=utf-8")
    resp["Cache-Control"] = "no-cache"
    resp["X-Accel-Buffering"] = "no"
    return resp