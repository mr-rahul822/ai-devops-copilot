const severityStyles = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-gray-100 text-gray-500',
}

export default function AlertBadge({ severity }) {
  const sev = (severity || 'low').toLowerCase()
  const style = severityStyles[sev] || severityStyles.low
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${style}`}>
      {sev}
    </span>
  )
}
