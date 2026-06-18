const severityStyles = {
  critical: 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-transparent dark:border-red-900/50',
  high: 'bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 border border-transparent dark:border-orange-900/50',
  medium: 'bg-yellow-100 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-400 border border-transparent dark:border-yellow-900/50',
  low: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-transparent dark:border-gray-700/50',
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
