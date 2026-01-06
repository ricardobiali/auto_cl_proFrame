import { useEffect, useMemo, useState } from "react"

type WelcomeResponse = {
    ok: boolean
    login: string
    name: string
    gender: "m" | "f"
}

export function useWelcome() {
    const [data, setData] = useState<WelcomeResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        const ctrl = new AbortController()

        async function run() {
        setLoading(true)
        setError(null)

        try {
            const r = await fetch("/api/core/welcome/", {
            method: "GET",
            headers: { Accept: "application/json" },
            signal: ctrl.signal,
            })

            if (!r.ok) {
            const txt = await r.text().catch(() => "")
            throw new Error(txt || `Erro HTTP ${r.status}`)
            }

            const json = (await r.json()) as WelcomeResponse

            if (!json?.ok) {
            throw new Error("Resposta inválida do backend (ok=false).")
            }

            if (!cancelled) setData(json)
        } catch (e: any) {
            if (e?.name === "AbortError") return
            if (!cancelled) setError(e?.message || "Falha ao carregar welcome.")
        } finally {
            if (!cancelled) setLoading(false)
        }
        }

        run()

        return () => {
        cancelled = true
        ctrl.abort()
        }
    }, [])

    const greeting = useMemo(() => {
        if (!data?.name) return ""
        const prefix = data.gender === "f" ? "Seja bem-vinda" : "Seja bem-vindo"
        return `${prefix}, ${data.name}!`
    }, [data])

    return { data, greeting, loading, error }
}