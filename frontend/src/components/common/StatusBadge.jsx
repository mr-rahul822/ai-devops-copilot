const variants = {
  COMPLETED: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500', label: 'Completed' },
  FAILED: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500', label: 'Failed' },
  REJECTED: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400', label: 'Rejected' },
  EXECUTING: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500', label: 'Executing' },
  PENDING_APPROVAL: { bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-500', label: 'Pending' },
  OPEN: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500', label: 'Open' },
  RESOLVED: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500', label: 'Resolved' },
  SUCCESS: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500', label: 'Success' },
  NOTICE: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500', label: 'Notice' },
  CRITICAL: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500', label: 'Critical' },
  INFO: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400', label: 'Info' },
  HIGH: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500', label: 'High' },
  MEDIUM: { bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-500', label: 'Medium' },
  LOW: { bg: 'bg-gray-100', text: 'text-gray-500', dot: 'bg-gray-400', label: 'Low' },
}

export default function StatusBadge({ status, label }) {
  const v = variants[status] || variants.INFO
  const displayLabel = label || v.label || status
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${v.bg} ${v.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${v.dot}`} />
      {displayLabel}
    </span>
  )
}
