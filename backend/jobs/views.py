from __future__ import annotations

import json
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
from jobs.services.file_io import save_json_atomic
from jobs.job_store import save_job_state

import logging
log = logging.getLogger(__name__)

log.info("Job %s iniciado")
log.exception("Falha no job %s")

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
    state: Optional[JobState] = None


JOBS: Dict[str, JobRuntime] = {}
JOBS_LOCK = threading.Lock()


# =========================
# Persistência mínima
# =========================

def _persist(job: JobRuntime) -> None:
    try:
        save_job_state(job)
    except Exception:
        pass


def _emit(job: JobRuntime, event: str, data: Any) -> None:
    job.q.put({"event": event, "data": data, "ts": time.time()})

    if event == "status" and isinstance(data, dict):
        job.status = data.get("status", job.status)
        job.message = data.get("message", job.message)
        job.error = data.get("error", job.error)
        _persist(job)

    if event == "done":
        if job.finished_at is None:
            job.finished_at = time.time()
        _persist(job)


def _get_job(job_id: str) -> Optional[JobRuntime]:
    with JOBS_LOCK:
        return JOBS.get(job_id)


# =========================
# JobState -> SSE adapter
# =========================

class SSEJobState(JobState):
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
        _emit(self._job, "status", {"status": final_status, "message": message})
        _emit(self._job, "done", {"status": final_status})


# =========================
# Helpers
# =========================

def _normalize_paths(payload: dict) -> dict:
    paths = payload.get("paths") or {}
    if isinstance(paths, list) and paths:
        return paths[0] if isinstance(paths[0], dict) else {}
    if isinstance(paths, dict):
        return paths
    return {}


def _normalize_switches(payload: dict, job_type: str) -> dict:
    sw = payload.get("switches")
    if isinstance(sw, dict) and sw:
        return sw

    jt = (job_type or "sap").lower()
    if jt in ("sequence", "sequencia", "full"):
        return {"report_SAP": True, "completa": True, "reduzida": True}
    if jt == "completa":
        return {"report_SAP": False, "completa": True, "reduzida": False}
    if jt == "reduzida":
        return {"report_SAP": False, "completa": False, "reduzida": True}
    return {"report_SAP": True, "completa": False, "reduzida": False}


def _normalize_requests(payload: dict) -> list:
    r = payload.get("requests") or []
    return r if isinstance(r, list) else []


# =========================
# Worker -> JobRunner
# =========================

def _run_job_worker(job: JobRuntime, payload: dict) -> None:
    try:
        job.status = "running"
        job.message = "Iniciando job..."
        _persist(job)

        _emit(job, "status", {"status": job.status, "message": job.message})

        backend_root = Path(__file__).resolve().parents[1]

        sap_script = backend_root / "sap_manager" / "ysclnrcl_job.py"
        completa_script = backend_root / "reports" / "completa_xl.py"
        reduzida_script = backend_root / "reports" / "reduzida.py"

        data_dir = backend_root / "data"
        data_dir.mkdir(parents=True, exist_ok=True)
        requests_path = data_dir / f"requests_{job.job_id}.json"

        paths = _normalize_paths(payload)
        switches = _normalize_switches(payload, job.job_type)
        requests = _normalize_requests(payload)

        save_json_atomic(
            requests_path,
            {
                "paths": [paths],
                "requests": requests,
                "status": [{}],
                "destino": [],
            },
        )

        state = SSEJobState(job)
        job.state = state

        def mirror_cancel():
            while job.finished_at is None and not job.cancel_event.is_set():
                time.sleep(0.2)
            if job.cancel_event.is_set():
                state.request_cancel()
                try:
                    state.terminate_children()
                except Exception:
                    pass

        threading.Thread(target=mirror_cancel, daemon=True).start()

        runner = JobRunner(
            state=state,
            requests_path=requests_path,
            sap_script=sap_script,
            completa_script=completa_script,
            reduzida_script=reduzida_script,
            creationflags=0,
        )

        runner.run_sequence(
            switches=switches,
            paths=paths,
            selecionar_arquivo_cb=lambda: [],
        )

        snap = state.snapshot()
        job.status = "success" if snap.get("success") else "error"
        job.message = snap.get("message", job.message)
        job.finished_at = time.time()
        _persist(job)

    except Exception as e:
        job.status = "error"
        job.message = "Falha na execução."
        job.error = str(e)
        job.finished_at = time.time()
        _persist(job)

        _emit(job, "log", f"Erro: {e}")
        _emit(job, "status", {"status": job.status, "message": job.message})
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

    job_id = str(uuid.uuid4())
    job_type = payload.get("type", "sap")

    job = JobRuntime(job_id=job_id, job_type=job_type, message="Na fila...")

    with JOBS_LOCK:
        JOBS[job_id] = job

    _persist(job)

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
    job.status = "canceled"
    job.message = "Cancelamento solicitado..."
    _persist(job)

    if job.state:
        try:
            job.state.request_cancel()
            job.state.terminate_children()
        except Exception:
            pass

    _emit(job, "status", {"status": "canceled", "message": job.message})
    return JsonResponse({"ok": True, "job_id": job_id})


def stream_job(request, job_id: str):
    job = _get_job(job_id)
    if not job:
        return JsonResponse({"ok": False, "error": "job_not_found"}, status=404)

    def sse_pack(event: str, data: Any) -> str:
        return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"

    def event_stream():
        yield sse_pack("hello", {"job_id": job.job_id, "status": job.status, "message": job.message})

        last_ping = time.time()

        while True:
            if job.finished_at and job.q.empty():
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