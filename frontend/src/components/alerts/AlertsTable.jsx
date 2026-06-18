import AlertBadge from './AlertBadge'
import { timeAgo } from '../../utils/formatters'

export default function AlertsTable({ alerts = [], onDiagnose, onResolve, diagnosingId }) {
  if (alerts.length === 0) {
    return (
      <div className="text-center py-12 text-[#64748b] text-sm">
        No alerts match your filters.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#e2e8f0] dark:border-gray-700">
            <th className="text-left text-[10px] font-bold tracking-[0.1em] text-[#64748b] dark:text-gray-400 uppercase py-3 pr-4">Severity</th>
            <th className="text-left text-[10px] font-bold tracking-[0.1em] text-[#64748b] dark:text-gray-400 uppercase py-3 pr-4">Service</th>
            <th className="text-left text-[10px] font-bold tracking-[0.1em] text-[#64748b] dark:text-gray-400 uppercase py-3 pr-4">Message</th>
            <th className="text-left text-[10px] font-bold tracking-[0.1em] text-[#64748b] dark:text-gray-400 uppercase py-3 pr-4">Time</th>
            <th className="text-left text-[10px] font-bold tracking-[0.1em] text-[#64748b] dark:text-gray-400 uppercase py-3 pr-4">Status</th>
            <th className="text-right text-[10px] font-bold tracking-[0.1em] text-[#64748b] dark:text-gray-400 uppercase py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {alerts.map((alert) => {
            const isOpen = (alert.status || '').toLowerCase() !== 'resolved'
            return (
              <tr key={alert.id} className="border-b border-[#f1f5f9] dark:border-gray-700/50 hover:bg-[#f8fafc] dark:hover:bg-gray-800/40">
                <td className="py-3 pr-4">
                  <AlertBadge severity={alert.severity} />
                </td>
                <td className="py-3 pr-4 font-semibold text-[#0f172a] dark:text-gray-200 text-xs">
                  {alert.service_name || alert.service || 'unknown'}
                </td>
                <td className="py-3 pr-4 text-[#64748b] dark:text-gray-400 text-xs max-w-xs truncate">
                  {alert.message || alert.alert_type || '—'}
                </td>
                <td className="py-3 pr-4 text-[#64748b] dark:text-gray-400 text-xs whitespace-nowrap">
                  {timeAgo(alert.created_at || alert.timestamp)}
                </td>
                <td className="py-3 pr-4">
                  <span className="flex items-center gap-1.5 text-xs">
                    <span className={`w-2 h-2 rounded-full ${isOpen ? 'bg-red-500' : 'bg-green-500'}`} />
                    <span className={isOpen ? 'text-red-600' : 'text-green-600'}>
                      {isOpen ? 'OPEN' : 'RESOLVED'}
                    </span>
                  </span>
                </td>
                <td className="py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => onDiagnose(alert)}
                      disabled={diagnosingId === alert.id}
                      className="text-[11px] font-semibold text-[#2563eb] border border-[#2563eb] px-3 py-1.5 rounded-md hover:bg-[#2563eb] hover:text-white disabled:opacity-50 transition-colors"
                    >
                      {diagnosingId === alert.id ? 'Analyzing...' : 'Diagnose'}
                    </button>
                    {isOpen && (
                      <button
                        onClick={() => onResolve(alert.id)}
                        className="text-[11px] font-semibold text-[#16a34a] border border-[#16a34a] px-3 py-1.5 rounded-md hover:bg-[#16a34a] hover:text-white transition-colors"
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
