import type { RequestRow } from "../types/jobs"
import TooltipHeader from "./TooltipHeader"

type Props = {
    rows: RequestRow[]
    onChange: (idx: number, next: RequestRow) => void
}

export default function RequestsTable({ rows, onChange }: Props) {
    function set(idx: number, patch: Partial<RequestRow>) {
        onChange(idx, { ...rows[idx], ...patch })
    }

    function ddmmyyyyFromInputDate(value: string) {
        // value vem como "YYYY-MM-DD"
        if (!value) return ""
        const [y, m, d] = value.split("-")
        return `${d}${m}${y}`
    }

    return (
        <div className="table-container fade-toggle mb-3 show">
        <table className="table table-bordered table-hover">
            <thead className="table-light">
                <tr>
                    <th style={{ width: 36 }}>#</th>

                    <TooltipHeader label="Empresa">
                        <strong>Valores possíveis:</strong>
                        <br />
                        1000 - Petróleo Brasileiro S.A.
                        <br />
                        3500 - Guara BV
                        <br />
                        3900 - Tupi BV
                        <br />
                        3902 - Iara BV
                        <br />
                        Vazio - Todas as empresas
                    </TooltipHeader>

                    <th>Exercício</th>
                    <th>Trimestre</th>
                    <th>Campo/Bloco</th>

                    <TooltipHeader label="Fase">
                        <strong>Valores possíveis:</strong>
                        <br />
                        E - Exploração
                        <br />
                        D - Desenvolvimento
                        <br />
                        P - Produção
                    </TooltipHeader>

                    <TooltipHeader label="Status">
                        <strong>Valores possíveis:</strong>
                        <br />
                        1 - Próprio
                        <br />
                        2 - Devolvido
                        <br />
                        3 - Parceria
                        <br />
                        4 - Parceria não operada
                        <br />
                        5 - Modificado
                        <br />
                        6 - Inválidos
                        <br />
                        Vazio - Todos os status
                    </TooltipHeader>

                    <TooltipHeader label="Versão">
                        <strong>Valores possíveis:</strong>
                        <br />
                        0 - RCL Concessão
                        <br />
                        1 - RCL Partilha
                        <br />
                        2 - RGIT
                        <br />
                        3 - RCL Cessão Onerosa
                    </TooltipHeader>

                    <th>Seção.Expurgo</th>
                    <th>Def.Projeto</th>
                    <th>Data Início</th>
                    <th>Bidround proposto</th>
                    <th>RIT</th>
                </tr>
                </thead>

            <tbody>
            {rows.map((r, i) => (
                <tr key={i}>
                <td>{i + 1}</td>

                <td><input className="form-control" value={r.empresa} onChange={(e) => set(i, { empresa: e.target.value })} /></td>
                <td><input className="form-control" value={r.exercicio} onChange={(e) => set(i, { exercicio: e.target.value })} /></td>

                <td>
                    <select className="form-select" value={r.trimestre} onChange={(e) => set(i, { trimestre: e.target.value })}>
                    <option value="">Selecione...</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                    </select>
                </td>

                <td><input className="form-control" value={r.campo} onChange={(e) => set(i, { campo: e.target.value })} /></td>

                <td>
                    <select className="form-select" value={r.fase} onChange={(e) => set(i, { fase: e.target.value })}>
                    <option value="">Selecione...</option>
                    <option value="E">E</option>
                    <option value="D">D</option>
                    <option value="P">P</option>
                    </select>
                </td>

                <td>
                    <select className="form-select" value={r.status} onChange={(e) => set(i, { status: e.target.value })}>
                    <option value="">Selecione...</option>
                    {["1","2","3","4","5","6"].map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                </td>

                <td>
                    <select className="form-select" value={r.versao} onChange={(e) => set(i, { versao: e.target.value })}>
                    <option value="">Selecione...</option>
                    {["0","1","2","3"].map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                </td>

                <td>
                    <select className="form-select" value={r.secao} onChange={(e) => set(i, { secao: e.target.value })}>
                    <option value="">Selecione...</option>
                    {["ANP_0901", "CL_PADRAO"].map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                </td>

                <td><input className="form-control" value={r.defprojeto} onChange={(e) => set(i, { defprojeto: e.target.value })} /></td>

                <td>
                    <input
                    className="form-control"
                    type="date"
                    onChange={(e) => set(i, { datainicio: ddmmyyyyFromInputDate(e.target.value) })}
                    />
                </td>

                <td><input className="form-control" value={r.bidround} onChange={(e) => set(i, { bidround: e.target.value })} /></td>

                <td>
                    <div className="form-check form-switch d-flex justify-content-center">
                    <input
                        className="form-check-input"
                        type="checkbox"
                        checked={r.rit}
                        onChange={(e) => set(i, { rit: e.target.checked })}
                    />
                    </div>
                </td>
                </tr>
            ))}
            </tbody>
        </table>
        </div>
    )
}