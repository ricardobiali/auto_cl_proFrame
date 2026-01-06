export type StartResponse = { ok: boolean; job_id: string; error?: string }

export async function startJob(payload: unknown): Promise<StartResponse> {
    const r = await fetch("/api/jobs/start/", {   // ✅ barra final
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    })

    const data = await r.json().catch(async () => {
        const txt = await r.text().catch(() => "")
        throw new Error(txt || `Resposta inválida do servidor (HTTP ${r.status})`)
    })

    if (!r.ok) {
        throw new Error(data?.error || `Erro HTTP ${r.status}`)
    }

    if (!data?.ok || !data?.job_id) {
        throw new Error(data?.error || "Backend não retornou job_id.")
    }

    return data
}

export async function cancelJob(
    jobId: string
    ): Promise<{ ok: boolean; job_id: string; error?: string }> {
    const r = await fetch(`/api/jobs/cancel/${jobId}/`, { method: "POST" }) // ✅ barra final

    const data = await r.json().catch(async () => {
        const txt = await r.text().catch(() => "")
        throw new Error(txt || `Resposta inválida do servidor (HTTP ${r.status})`)
    })

    if (!r.ok) {
        throw new Error(data?.error || `Erro HTTP ${r.status}`)
    }

    return data
}