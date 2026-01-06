type Props = { onCancel: () => void }

export default function CancelSection({ onCancel }: Props) {
    return (
        <div id="cancelSection" className="mt-3 fade-toggle show">
        <button id="cancelBtn" type="button" className="btn btn-outline-danger w-100" onClick={onCancel}>
            <i className="fa-solid fa-stop me-2" />Cancelar // Reiniciar
        </button>
        </div>
    )
}