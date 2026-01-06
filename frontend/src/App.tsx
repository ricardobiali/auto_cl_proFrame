// frontend/src/App.tsx
import { useEffect, useMemo, useState } from "react"

import Header from "./components/Header"
import Welcome from "./components/Welcome"
import ConfigSwitches from "./components/ConfigSwitches"
import RequestsTable from "./components/RequestsTable"
import PathsForm from "./components/PathsForm"
import RunSection from "./components/RunSection"
import Avisos from "./components/Avisos"
import CancelSection from "./components/CancelSection"
import Footer from "./components/Footer"

import type { Paths, RequestRow, Switches } from "./types/jobs"

import { startJob, cancelJob } from "./services/jobsApi"
import { useJobSse } from "./hooks/useJobSse"

const DEFAULT_PATHS: Paths = {
  path1: "",
  path2: "",
  path3: "",
  path4: "",
  path5: "",
  path6: "",
}

const DEFAULT_SWITCHES: Switches = {
  report_SAP: false,
  completa: false,
  reduzida: false,
  diretos: false,
  indiretos: false,
  estoques: false,
}

export default function App() {
  const [switches, setSwitches] = useState<Switches>(DEFAULT_SWITCHES)

  const [rows, setRows] = useState<RequestRow[]>(
    Array.from({ length: 20 }, () => ({
      empresa: "",
      exercicio: "",
      trimestre: "",
      campo: "",
      fase: "",
      status: "",
      versao: "",
      secao: "",
      defprojeto: "",
      datainicio: "",
      bidround: "",
      rit: false,
    }))
  )

  const [paths, setPaths] = useState<Paths>(DEFAULT_PATHS)

  const [isRunningUI, setIsRunningUI] = useState(false)

  const [avisos, setAvisos] = useState<string[]>([])
  const [finalStatus, setFinalStatus] = useState<{ ok: boolean; message: string } | null>(null)

  const [jobId, setJobId] = useState<string | null>(null)

  // ✅ agora o hook expõe close() para parar SSE imediatamente
  const { status, message, error, logs, done, close } = useJobSse(jobId)

  const anySwitchOn = useMemo(() => Object.values(switches).some(Boolean), [switches])

  const showTable = switches.report_SAP && !isRunningUI
  const showDirs = anySwitchOn && !isRunningUI
  const showRun = anySwitchOn && !isRunningUI
  const showCancel = isRunningUI

  function buildAvisosFromSwitches(s: Switches) {
    const msgs: string[] = []
    if (s.report_SAP) msgs.push("Aguardando requisição da base do SAP")
    if (s.completa) msgs.push("Aguardando relatório completo")
    if (s.reduzida) msgs.push("Aguardando relatório reduzido")
    if (s.diretos) msgs.push("Aguardando relatório de Gastos Diretos")
    if (s.indiretos) msgs.push("Aguardando relatório de Gastos Indiretos")
    if (s.estoques) msgs.push("Aguardando relatório de Estoques")
    return msgs
  }

  // ✅ Atualiza o "aviso principal" (primeiro spinner) com a mensagem viva do backend
  useEffect(() => {
    if (!isRunningUI) return
    if (!message) return
    setAvisos((prev) => {
      if (!prev.length) return prev
      const next = [...prev]
      next[0] = message
      return next
    })
  }, [isRunningUI, message])

  // ✅ quando o SSE terminar, fecha a UI com status final
  useEffect(() => {
    if (!jobId || !done) return

    const ok = status === "success"
    const finalMsg =
      status === "success"
        ? message || "Concluído."
        : status === "canceled"
        ? "Cancelado."
        : error
        ? `Falha: ${error}`
        : message || "Falha na execução."

    setFinalStatus({ ok, message: finalMsg })
  }, [jobId, done, status, message, error])

  async function onRun() {
    const requests = rows.filter((r) => {
      const { rit, ...rest } = r
      return Object.values(rest).some((v) => String(v).trim() !== "") || rit === true
    })

    const payload = {
      type: "sequence",
      switches,
      paths: [paths], // ✅ backend aceita array (e também normaliza)
      requests,
    }

    setIsRunningUI(true)
    setFinalStatus(null)
    setAvisos(buildAvisosFromSwitches(switches))

    // ✅ garante que não fica SSE antigo aberto
    close()
    setJobId(null)

    try {
      const r = await startJob(payload)
      setJobId(r.job_id)
    } catch (e: any) {
      setFinalStatus({ ok: false, message: e?.message || "Erro ao iniciar job." })
      setIsRunningUI(false)
    }
  }

  async function onCancel() {
    // ✅ 1) UI instantânea: para SSE imediatamente
    close()

    // ✅ 2) feedback imediato
    setFinalStatus({ ok: false, message: "Cancelamento solicitado..." })

    // ✅ 3) chama backend (sem travar a UI)
    try {
      if (jobId) await cancelJob(jobId)
    } catch (e: any) {
      setFinalStatus({ ok: false, message: e?.message || "Erro ao cancelar." })
    }

    setTimeout(() => window.location.reload(), 800)
  }

  return (
    <div className="container">
      <Header />

      <div className="d-flex align-items-center justify-content-center mb-4">
        <Welcome />
      </div>

      {!isRunningUI && (
        <ConfigSwitches switches={switches} onChange={(next) => setSwitches(next)} />
      )}

      {showTable && (
        <RequestsTable
          rows={rows}
          onChange={(idx, nextRow) => {
            setRows((prev) => prev.map((r, i) => (i === idx ? nextRow : r)))
          }}
        />
      )}

      {showDirs && (
        <PathsForm switches={switches} paths={paths} onChange={(next) => setPaths(next)} />
      )}

      {showRun && <RunSection onRun={onRun} />}

      <Avisos
        visible={isRunningUI || avisos.length > 0 || !!finalStatus}
        mensagens={avisos}
        finalStatus={finalStatus}
        logs={logs}
      />

      {showCancel && <CancelSection onCancel={onCancel} />}

      <Footer />
    </div>
  )
}