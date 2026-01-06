import type { Paths, Switches } from "../types/jobs"

type Props = {
    switches: Switches
    paths: Paths
    onChange: (next: Paths) => void
}

export default function PathsForm({ switches, paths, onChange }: Props) {
    function set<K extends keyof Paths>(key: K, value: string) {
        onChange({ ...paths, [key]: value })
    }

    return (
        <div className="form-section fade-toggle show">
        <h5>Diretórios de armazenamento dos relatórios</h5>

        {switches.report_SAP && (
            <div className="mb-3">
            <label className="form-label">Diretório de armazenamento - Base SAP</label>
            <div className="input-group">
                <span className="input-group-text"><i className="fa-solid fa-folder" /></span>
                <input className="form-control" value={paths.path1} onChange={(e) => set("path1", e.target.value)} placeholder="C:\Users\..." />
            </div>
            </div>
        )}

        {switches.completa && (
            <div className="mb-3">
            <label className="form-label">Diretório de armazenamento - Reporte Completo</label>
            <div className="input-group">
                <span className="input-group-text"><i className="fa-solid fa-folder" /></span>
                <input className="form-control" value={paths.path2} onChange={(e) => set("path2", e.target.value)} placeholder="C:\Users\..." />
            </div>
            </div>
        )}

        {switches.reduzida && (
            <div className="mb-3">
            <label className="form-label">Diretório de armazenamento - Reporte Reduzido</label>
            <div className="input-group">
                <span className="input-group-text"><i className="fa-solid fa-folder" /></span>
                <input className="form-control" value={paths.path3} onChange={(e) => set("path3", e.target.value)} placeholder="C:\Users\..." />
            </div>
            </div>
        )}

        {switches.diretos && (
            <div className="mb-3">
            <label className="form-label">Diretório de armazenamento - Gastos Diretos</label>
            <div className="input-group">
                <span className="input-group-text"><i className="fa-solid fa-folder" /></span>
                <input className="form-control" value={paths.path4} onChange={(e) => set("path4", e.target.value)} placeholder="C:\Users\..." />
            </div>
            </div>
        )}

        {switches.indiretos && (
            <div className="mb-3">
            <label className="form-label">Diretório de armazenamento - Gastos Indiretos</label>
            <div className="input-group">
                <span className="input-group-text"><i className="fa-solid fa-folder" /></span>
                <input className="form-control" value={paths.path5} onChange={(e) => set("path5", e.target.value)} placeholder="C:\Users\..." />
            </div>
            </div>
        )}

        {switches.estoques && (
            <div className="mb-3">
            <label className="form-label">Diretório de armazenamento - Estoques</label>
            <div className="input-group">
                <span className="input-group-text"><i className="fa-solid fa-folder" /></span>
                <input className="form-control" value={paths.path6} onChange={(e) => set("path6", e.target.value)} placeholder="C:\Users\..." />
            </div>
            </div>
        )}
        </div>
    )
}