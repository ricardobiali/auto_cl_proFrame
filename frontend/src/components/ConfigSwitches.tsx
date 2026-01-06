import type { Switches } from "../types/jobs"

type Props = {
    switches: Switches
    onChange: (next: Switches) => void
}

export default function ConfigSwitches({ switches, onChange }: Props) {
    function set<K extends keyof Switches>(key: K, value: boolean) {
        onChange({ ...switches, [key]: value })
    }

    return (
        <div className="form-section">
        <h5>Opções de Configuração</h5>

        <div className="row row-cols-2 g-3 mt-2">
            <div className="col">
            <div className="d-flex flex-column gap-2">
                <div className="form-check form-switch">
                <input className="form-check-input" type="checkbox" id="switch1"
                    checked={switches.report_SAP}
                    onChange={(e) => set("report_SAP", e.target.checked)}
                />
                <label className="form-check-label" htmlFor="switch1">Solicitação na base do SAP</label>
                </div>

                <div className="form-check form-switch">
                <input className="form-check-input" type="checkbox" id="switch2"
                    checked={switches.completa}
                    onChange={(e) => set("completa", e.target.checked)}
                />
                <label className="form-check-label" htmlFor="switch2">Reporte Completo</label>
                </div>

                <div className="form-check form-switch">
                <input className="form-check-input" type="checkbox" id="switch3"
                    checked={switches.reduzida}
                    onChange={(e) => set("reduzida", e.target.checked)}
                />
                <label className="form-check-label" htmlFor="switch3">Reporte Reduzido</label>
                </div>
            </div>
            </div>

            <div className="col">
            <div className="d-flex flex-column gap-2">
                <div className="form-check form-switch">
                <input className="form-check-input" type="checkbox" id="switch4"
                    checked={switches.diretos}
                    onChange={(e) => set("diretos", e.target.checked)}
                />
                <label className="form-check-label" htmlFor="switch4">Gastos Diretos</label>
                </div>

                <div className="form-check form-switch">
                <input className="form-check-input" type="checkbox" id="switch5"
                    checked={switches.indiretos}
                    onChange={(e) => set("indiretos", e.target.checked)}
                />
                <label className="form-check-label" htmlFor="switch5">Gastos Indiretos</label>
                </div>

                <div className="form-check form-switch">
                <input className="form-check-input" type="checkbox" id="switch6"
                    checked={switches.estoques}
                    onChange={(e) => set("estoques", e.target.checked)}
                />
                <label className="form-check-label" htmlFor="switch6">Estoques</label>
                </div>
            </div>
            </div>
        </div>
        </div>
    )
}