import { useQuery } from '@tanstack/react-query'
import { getIncidents } from '../../api/ai'
import { timeAgo } from '../../utils/formatters'
import EmptyState from '../common/EmptyState'

const tagColors = {
  cpu_spike: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', label: 'SCALING' },
  high_cpu: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', label: 'SCALING' },
  traffic: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400', label: 'TRAFFIC' },
  ram_critical: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400', label: 'TRAFFIC' },
  security: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: 'SECURITY' },
  disk_warning: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', label: 'STORAGE' },
  service_silent: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: 'SECURITY' },
}

function getTag(alertType) {
  return tagColors[alertType] || tagColors.cpu_spike
}

export default function CopilotDecisions() {
  const { data: incidents, isError } = useQuery({
    queryKey: ['incidents'],
    queryFn: async () => {
      const res = await getIncidents()
      return res.data?.incidents || res.data || []
    },
    refetchInterval: 30_000,
  })

  const items = Array.isArray(incidents) ? incidents.slice(0, 3) : []

  return (
    <div className="bg-white/80 dark:bg-gray-800/60 backdrop-blur-md border border-white/20 dark:border-gray-700/50 rounded-2xl p-5 h-full flex flex-col transition-colors">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <svg className="w-4 h-4 text-[#2563eb]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <h3 className="text-xs font-bold tracking-[0.1em] text-[#0f172a] dark:text-gray-100 uppercase">Cloudy Bro Decisions</h3>
      </div>
      <p className="text-[11px] text-[#64748b] dark:text-gray-400 mb-4">Last 3 automated events</p>

      {/* Items */}
      <div className="flex-1 space-y-4">
        {isError && (
          <p className="text-xs text-[#64748b] dark:text-gray-400">AI Engine unavailable</p>
        )}
        {!isError && items.length === 0 && (
          <EmptyState
            title="No AI decisions yet"
            description="Incidents will appear here as your system self-heals."
          />
        )}
        {items.map((item, i) => {
          const tag = getTag(item.alert_type || item.type || 'cpu_spike')
          return (
            <div key={i} className="border-b border-[#e2e8f0] dark:border-gray-700 pb-3 last:border-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${tag.bg} ${tag.text}`}>
                  {tag.label}
                </span>
                <span className="text-[11px] text-[#94a3b8]">
                  {timeAgo(item.created_at || item.timestamp)}
                </span>
              </div>
              <p className="text-sm text-[#0f172a] dark:text-gray-100 leading-snug">
                {item.simple_explanation || item.summary || item.message || 'Automated action completed'}
              </p>
              <p className="text-[11px] text-[#94a3b8] mt-1 flex items-center gap-1">
                <span>↗</span> {item.root_cause || item.detail || 'System auto-recovered'}
              </p>
            </div>
          )
        })}
      </div>

      {/* Bottom button */}
      <a
        href="/settings"
        className="mt-4 block w-full text-center bg-[#0f172a] dark:bg-[#2563eb] text-white text-xs font-semibold py-3 rounded-lg hover:bg-[#1e293b] dark:hover:bg-[#1d4ed8] transition-colors"
      >
        MANAGE POLICIES →
      </a>
    </div>
  )
}
