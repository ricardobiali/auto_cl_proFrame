// frontend/src/hooks/useJobSse.ts
import { useCallback, useEffect, useRef, useState } from "react"

type JobStatus = "queued" | "running" | "success" | "error" | "canceled"

export function useJobSse(jobId: string | null) {
    const [status, setStatus] = useState<JobStatus>("queued")
    const [message, setMessage] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [logs, setLogs] = useState<string[]>([])
    const [done, setDone] = useState(false)

    const esRef = useRef<EventSource | null>(null)

    const close = useCallback(() => {
        try {
        esRef.current?.close()
        } catch {}
        esRef.current = null
    }, [])

    useEffect(() => {
        // reset ao iniciar novo job
        setLogs([])
        setDone(false)
        setError(null)
        setMessage("")
        setStatus("queued")

        // fecha qualquer SSE anterior
        close()

        if (!jobId) return

        const es = new EventSource(`/api/jobs/stream/${jobId}`)
        esRef.current = es

        es.addEventListener("hello", (ev: MessageEvent) => {
        try {
            const data = JSON.parse(ev.data)
            if (data?.status) setStatus(data.status)
            if (typeof data?.message === "string") setMessage(data.message)
        } catch {}
        })

        es.addEventListener("status", (ev: MessageEvent) => {
        try {
            const data = JSON.parse(ev.data)
            if (data?.status) setStatus(data.status)
            if (typeof data?.message === "string") setMessage(data.message)
            if (data?.error) setError(String(data.error))
        } catch {}
        })

        es.addEventListener("log", (ev: MessageEvent) => {
        const line = String(ev.data ?? "").trim()
        if (!line) return
        setLogs((prev) => [...prev, line])
        })

        es.addEventListener("done", (ev: MessageEvent) => {
        try {
            const data = JSON.parse(ev.data)
            if (data?.status) setStatus(data.status)
        } catch {}
        setDone(true)
        close()
        })

        es.addEventListener("error", () => {
        // erro de conexão SSE
        setError((prev) => prev || "Falha na conexão SSE.")
        // NÃO fecha automaticamente aqui, porque às vezes o browser tenta reconectar
        // (mas no cancel nós fecharemos manualmente)
        })

        return () => close()
    }, [jobId, close])

    return { status, message, error, logs, done, close }
}