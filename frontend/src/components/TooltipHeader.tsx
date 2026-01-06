type Props = {
    label: string
    children: React.ReactNode
}

export default function TooltipHeader({ label, children }: Props) {
    return (
        <th className="tooltip-header">
        {label}
        <span className="tooltip-box">{children}</span>
        </th>
    )
}