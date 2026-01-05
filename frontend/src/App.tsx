import React, { useEffect, useMemo, useState } from "react";

type Switches = {
  report_SAP: boolean;
  completa: boolean;
  reduzida: boolean;
  diretos: boolean;
  indiretos: boolean;
  estoques: boolean;
};

type Row = {
  empresa: string;
  exercicio: string;
  trimestre: string;
  campo: string;
  fase: string;
  status: string;
  versao: string;
  secao: string;
  defprojeto: string;
  datainicio: string; // yyyy-mm-dd (no input)
  bidround: string;
  rit: boolean;
};

type Paths = {
  path1: string;
  path2: string;
  path3: string;
  path4: string;
  path5: string;
  path6: string;
};

function formatDateToDDMMAAAA(raw: string) {
  if (!raw) return "";
  const [y, m, d] = raw.split("-");
  if (!y || !m || !d) return "";
  return `${d}${m}${y}`;
}

export default function App() {
  // --------- estado base ----------
  const [welcome, setWelcome] = useState("Seja bem-vindo(a)");
  const [switches, setSwitches] = useState<Switches>({
    report_SAP: false,
    completa: false,
    reduzida: false,
    diretos: false,
    indiretos: false,
    estoques: false,
  });

  const [paths, setPaths] = useState<Paths>({
    path1: "",
    path2: "",
    path3: "",
    path4: "",
    path5: "",
    path6: "",
  });

  const rowsCount = 20;

  const [rows, setRows] = useState<Row[]>(
    Array.from({ length: rowsCount }, () => ({
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
  );

  // --------- avisos / execução ----------
  const [running, setRunning] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string>("");
  const [logs, setLogs] = useState<string[]>([]);
  const [finalMsg, setFinalMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const anySwitchOn = useMemo(() => Object.values(switches).some(Boolean), [switches]);

  // (placeholder) welcome - depois você liga no backend
  useEffect(() => {
    setWelcome("Seja bem-vindo(a), Ricardo!");
  }, []);

  // --------- helpers UI ----------
  function setSwitch(key: keyof Switches, value: boolean) {
    setSwitches((s) => ({ ...s, [key]: value }));
  }

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((prev) => {
      const copy = [...prev];
      copy[i] = { ...copy[i], ...patch };
      return copy;
    });
  }

  function buildPayload() {
    // filtra linhas “com valor”
    const requests = rows
      .map((r) => ({
        ...r,
        datainicio: formatDateToDDMMAAAA(r.datainicio),
      }))
      .filter((r) => {
        const { rit, ...rest } = r as any;
        return Object.values(rest).some((v) => String(v || "").trim() !== "");
      });

    return {
      switches,
      paths: [paths],
      requests,
    };
  }

  // --------- RUN (SSE) ----------
  async function startAutomation() {
    setFinalMsg(null);
    setLogs([]);
    setStatusMsg("");
    setRunning(true);

    try {
      const payload = buildPayload();

      // ✅ aqui você pode também ter um endpoint /api/jobs/save_requests se quiser persistir
      // por enquanto vamos só iniciar o job no Django
      const resp = await fetch("http://127.0.0.1:8000/api/jobs/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "sap", payload }), // você decide o contrato
      });

      const data = await resp.json();
      if (!data.ok || !data.job_id) {
        throw new Error(data.error || "Falha ao iniciar job");
      }

      setJobId(data.job_id);

      // abre SSE
      const es = new EventSource(`http://127.0.0.1:8000/api/jobs/stream/${data.job_id}`);

      es.addEventListener("hello", (ev: MessageEvent) => {
        try {
          const d = JSON.parse(ev.data);
          if (d?.message) setStatusMsg(d.message);
        } catch {}
      });

      es.addEventListener("status", (ev: MessageEvent) => {
        try {
          const d = JSON.parse(ev.data);
          if (d?.message) setStatusMsg(d.message);
          if (d?.status === "success") {
            setFinalMsg({ ok: true, text: d.message || "Concluído." });
          }
          if (d?.status === "error") {
            setFinalMsg({ ok: false, text: d.message || "Falha." });
          }
          if (d?.status === "canceled") {
            setFinalMsg({ ok: false, text: d.message || "Cancelado." });
          }
        } catch {}
      });

      es.addEventListener("log", (ev: MessageEvent) => {
        setLogs((prev) => [...prev, String(ev.data)]);
      });

      es.addEventListener("done", () => {
        es.close();
        setRunning(false);
      });

      es.onerror = () => {
        // se o server fechar sem "done", aqui pega
        // não fecha imediatamente (EventSource tenta reconectar),
        // mas no protótipo podemos encerrar:
        // es.close();
      };
    } catch (e: any) {
      setRunning(false);
      setFinalMsg({ ok: false, text: e?.message || "Erro desconhecido." });
    }
  }

  async function cancelAutomation() {
    if (!jobId) {
      window.location.reload();
      return;
    }
    try {
      setStatusMsg("Cancelando automação...");
      await fetch(`http://127.0.0.1:8000/api/jobs/cancel/${jobId}`, { method: "POST" });
      // você pode esperar SSE "canceled", ou recarregar
      setTimeout(() => window.location.reload(), 800);
    } catch {
      window.location.reload();
    }
  }

  // --------- Render ----------
  return (
    <div className="container">
      <div className="header-image">
        <img src="/media/header.png" alt="Cabeçalho" />
      </div>

      <div className="d-flex align-items-center justify-content-center mb-4">
        <img src="/media/logo_br.jpg" alt="Logo Petrobras" style={{ height: 45, marginRight: 30 }} />
        <h2 className="text-center mb-4">Pré-Auditoria de Conteúdo Local</h2>
      </div>

      <div>
        <p className="mb-0" style={{ textAlign: "left", fontWeight: "bold" }}>
          {welcome}
        </p>
      </div>

      {/* Opções */}
      {!running && (
        <div className="form-section">
          <h5>Opções de Configuração</h5>
          <div className="row row-cols-2 g-3 mt-2">
            <div className="col">
              <div className="d-flex flex-column gap-2">
                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="switch1"
                    checked={switches.report_SAP}
                    onChange={(e) => setSwitch("report_SAP", e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="switch1">
                    Solicitação na base do SAP
                  </label>
                </div>

                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="switch2"
                    checked={switches.completa}
                    onChange={(e) => setSwitch("completa", e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="switch2">
                    Reporte Completo
                  </label>
                </div>

                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="switch3"
                    checked={switches.reduzida}
                    onChange={(e) => setSwitch("reduzida", e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="switch3">
                    Reporte Reduzido
                  </label>
                </div>
              </div>
            </div>

            <div className="col">
              <div className="d-flex flex-column gap-2">
                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="switch4"
                    checked={switches.diretos}
                    onChange={(e) => setSwitch("diretos", e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="switch4">
                    Gastos Diretos
                  </label>
                </div>

                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="switch5"
                    checked={switches.indiretos}
                    onChange={(e) => setSwitch("indiretos", e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="switch5">
                    Gastos Indiretos
                  </label>
                </div>

                <div className="form-check form-switch">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="switch6"
                    checked={switches.estoques}
                    onChange={(e) => setSwitch("estoques", e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="switch6">
                    Estoques
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabela */}
      {!running && switches.report_SAP && (
        <div className="table-container fade-toggle mb-3 show">
          <table className="table table-bordered table-hover">
            <thead className="table-light">
              <tr>
                <th style={{ width: 36 }}>#</th>
                <th>Empresa</th>
                <th>Exercício</th>
                <th>Trimestre</th>
                <th>Campo/Bloco</th>
                <th>Fase</th>
                <th>Status</th>
                <th>Versão</th>
                <th>Seção.Expurgo</th>
                <th>Def.Projeto</th>
                <th>Data Início</th>
                <th>Bidround proposto</th>
                <th>RIT</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r, idx) => (
                <tr key={idx}>
                  <td>{idx + 1}</td>

                  <td>
                    <input className="form-control" value={r.empresa} onChange={(e) => updateRow(idx, { empresa: e.target.value })} />
                  </td>
                  <td>
                    <input className="form-control" value={r.exercicio} onChange={(e) => updateRow(idx, { exercicio: e.target.value })} />
                  </td>
                  <td>
                    <select className="form-select" value={r.trimestre} onChange={(e) => updateRow(idx, { trimestre: e.target.value })}>
                      <option value="">Selecione...</option>
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                      <option value="4">4</option>
                    </select>
                  </td>
                  <td>
                    <input className="form-control" value={r.campo} onChange={(e) => updateRow(idx, { campo: e.target.value })} />
                  </td>
                  <td>
                    <select className="form-select" value={r.fase} onChange={(e) => updateRow(idx, { fase: e.target.value })}>
                      <option value="">Selecione...</option>
                      <option value="E">E</option>
                      <option value="D">D</option>
                      <option value="P">P</option>
                    </select>
                  </td>
                  <td>
                    <select className="form-select" value={r.status} onChange={(e) => updateRow(idx, { status: e.target.value })}>
                      <option value="">Selecione...</option>
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <option key={n} value={String(n)}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select className="form-select" value={r.versao} onChange={(e) => updateRow(idx, { versao: e.target.value })}>
                      <option value="">Selecione...</option>
                      {[0, 1, 2, 3].map((n) => (
                        <option key={n} value={String(n)}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select className="form-select" value={r.secao} onChange={(e) => updateRow(idx, { secao: e.target.value })}>
                      <option value="">Selecione...</option>
                      {["ANP_0901", "CL_PADRAO"].map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input className="form-control" value={r.defprojeto} onChange={(e) => updateRow(idx, { defprojeto: e.target.value })} />
                  </td>
                  <td>
                    <input className="form-control" type="date" value={r.datainicio} onChange={(e) => updateRow(idx, { datainicio: e.target.value })} />
                  </td>
                  <td>
                    <input className="form-control" value={r.bidround} onChange={(e) => updateRow(idx, { bidround: e.target.value })} />
                  </td>
                  <td>
                    <div className="form-check form-switch d-flex justify-content-center">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        role="switch"
                        checked={r.rit}
                        onChange={(e) => updateRow(idx, { rit: e.target.checked })}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Diretórios */}
      {!running && anySwitchOn && (
        <div className="form-section fade-toggle show">
          <h5>Diretórios de armazenamento dos relatórios</h5>

          <div className="mb-3" style={{ display: switches.report_SAP ? "" : "none" }}>
            <label className="form-label">Diretório de armazenamento - Base SAP</label>
            <div className="input-group">
              <span className="input-group-text">
                <i className="fa-solid fa-folder"></i>
              </span>
              <input
                type="text"
                className="form-control"
                placeholder="C:\Users\..."
                value={paths.path1}
                onChange={(e) => setPaths((p) => ({ ...p, path1: e.target.value }))}
              />
            </div>
          </div>

          <div className="mb-3" style={{ display: switches.completa ? "" : "none" }}>
            <label className="form-label">Diretório de armazenamento - Reporte Completo</label>
            <div className="input-group">
              <span className="input-group-text">
                <i className="fa-solid fa-folder"></i>
              </span>
              <input
                type="text"
                className="form-control"
                placeholder="C:\Users\..."
                value={paths.path2}
                onChange={(e) => setPaths((p) => ({ ...p, path2: e.target.value }))}
              />
            </div>
          </div>

          <div className="mb-3" style={{ display: switches.reduzida ? "" : "none" }}>
            <label className="form-label">Diretório de armazenamento - Reporte Reduzido</label>
            <div className="input-group">
              <span className="input-group-text">
                <i className="fa-solid fa-folder"></i>
              </span>
              <input
                type="text"
                className="form-control"
                placeholder="C:\Users\..."
                value={paths.path3}
                onChange={(e) => setPaths((p) => ({ ...p, path3: e.target.value }))}
              />
            </div>
          </div>

          {/* os outros você pode manter idêntico */}
        </div>
      )}

      {/* Botão executar */}
      {!running && anySwitchOn && (
        <div className="mt-4 fade-toggle show">
          <button type="button" className="btn btn-primary" onClick={startAutomation}>
            <i className="fa-solid fa-play me-2"></i>Executar Automação
          </button>
        </div>
      )}

      {/* Avisos / Logs */}
      {(running || finalMsg) && (
        <div className="mt-3" style={{ display: "block" }}>
          <ul className="aviso-text list-unstyled" role="alert">
            {running && (
              <li>
                <div className="spinner-border" role="status" aria-hidden="true"></div>
                <span>{statusMsg || "Executando..."}</span>
              </li>
            )}

            {logs.map((l, i) => (
              <li key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace" }}>
                  {l}
                </span>
              </li>
            ))}

            {finalMsg && !running && (
              <li style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {finalMsg.ok ? (
                  <i className="bi bi-check-circle-fill" style={{ color: "green", fontSize: "1.1rem" }}></i>
                ) : (
                  <i className="bi bi-x" style={{ color: "red", fontSize: "1.1rem" }}></i>
                )}
                <span>{finalMsg.text}</span>
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Cancelar / Reiniciar */}
      {(running || finalMsg) && (
        <div className="mt-3 fade-toggle show">
          <button type="button" className="btn btn-outline-danger w-100" onClick={cancelAutomation}>
            <i className="fa-solid fa-stop me-2"></i>
            {running ? "Cancelar // Reiniciar" : "Reiniciar"}
          </button>
        </div>
      )}

      <footer>
        <p className="mt-4 mb-0">© v.1.2.0 2026 Automação Petrobras | Desenvolvido por Ricardo Biali - U33V</p>
      </footer>
    </div>
  );
}