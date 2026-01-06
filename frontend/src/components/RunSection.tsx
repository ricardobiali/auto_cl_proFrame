type Props = { onRun: () => void }

export default function RunSection({ onRun }: Props) {
    return (
        <div id="runSection" className="mt-4 fade-toggle show">
        <button id="runBtn" type="button" className="btn btn-primary" onClick={onRun}>
            <i className="fa-solid fa-play me-2" />Executar Automação
        </button>
        </div>
    )
}