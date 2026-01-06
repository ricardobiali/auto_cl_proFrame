import { useEffect, useState } from "react"

type Profile = { name: string; gender: "m" | "f" }

export default function Welcome() {
    const [profile, setProfile] = useState<Profile>({ name: "", gender: "m" })

    useEffect(() => {
        let alive = true

        fetch("/api/core/welcome")
        .then((r) => r.json())
        .then((data) => {
            if (!alive) return
            setProfile({
            name: (data?.name || "").toString(),
            gender: (data?.gender || "m") === "f" ? "f" : "m",
            })
        })
        .catch(() => {
            // se falhar, mantém o "bem-vindo(a)" genérico
        })

        return () => {
        alive = false
        }
    }, [])

    const nome = profile.name?.trim()
    const saudacao = profile.gender === "f" ? "Seja bem-vinda" : "Seja bem-vindo"

    return (
        <div style={{ width: "100%" }}>
        <p className="mb-0" style={{ textAlign: "left", fontWeight: "bold" }}>
            {nome ? `${saudacao}, ${nome}!` : "Seja bem-vindo(a)"}
        </p>
        </div>
    )
}