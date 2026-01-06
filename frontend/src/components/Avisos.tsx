// frontend/src/components/Avisos.tsx
type Props = {
    visible: boolean
    mensagens: string[]
    finalStatus: { ok: boolean; message: string } | null
    logs?: string[]
}

export default function Avisos({ visible, mensagens, finalStatus, logs = [] }: Props) {
    if (!visible) return null

    return (
        <div id="avisosContainer" className="mt-3" style={{ display: "block" }}>
        <ul id="avisosContent" className="aviso-text list-unstyled" role="alert">
            {/* 1) spinners iniciais */}
            {!finalStatus &&
            mensagens.map((msg, idx) => (
                <li key={`spin-${idx}`}>
                <div className="spinner-border" role="status" aria-hidden="true" />
                <span>{msg}</span>
                </li>
            ))}

            {/* 2) logs append (igual EEL) */}
            {!finalStatus &&
            logs.map((line, idx) => (
                <li key={`log-${idx}`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                    style={{
                    fontFamily:
                        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                    }}
                >
                    {line}
                </span>
                </li>
            ))}

            {/* 3) status final */}
            {finalStatus && (
            <li style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <i
                className={finalStatus.ok ? "bi bi-check-circle-fill" : "bi bi-x"}
                style={{ color: finalStatus.ok ? "green" : "red", fontSize: "1.1rem" }}
                />
                <span>{finalStatus.message}</span>
            </li>
            )}
        </ul>
        </div>
    )
}