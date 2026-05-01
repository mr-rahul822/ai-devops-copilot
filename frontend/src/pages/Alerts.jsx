import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getAlerts, resolveAlert } from '../api/alerts'
import { analyzeIncident } from '../api/ai'
import AlertsTable from '../components/alerts/AlertsTable'
import LoadingSpinner from '../components/common/LoadingSpinner'

export default function Alerts() {
  const [statusFilter, setStatusFilter] = useState('all')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [diagnosingId, setDiagnosingId] = useState(null)
  const [diagResult, setDiagResult] = useState(null)
  const queryClient = useQueryClient()

  const { data: alerts, isLoading, isFetching } = useQuery({
    queryKey: ['alerts'],
    queryFn: async () => {
      const res = await getAlerts()
      return res.data?.alerts || res.data || []
    },
    refetchInterval: 15_000,
  })

  const filtered = (alerts || []).filter((a) => {
    if (statusFilter === 'open' && (a.status || '').toLowerCase() === 'resolved') return false
    if (statusFilter === 'resolved' && (a.status || '').toLowerCase() !== 'resolved') return false
    if (severityFilter !== 'all' && (a.severity || '').toLowerCase() !== severityFilter) return false
    if (search) {
      const s = search.toLowerCase()
      const svc = (a.service_name || a.service || '').toLowerCase()
      const msg = (a.message || '').toLowerCase()
      if (!svc.includes(s) && !msg.includes(s)) return false
    }
    return true
  })

  const handleDiagnose = async (alert) => {
    setDiagnosingId(alert.id)
    setDiagResult(null)
    try {
      const res = await analyzeIncident({
        alert_type: alert.alert_type || alert.severity || 'cpu_spike',
        service_name: alert.service_name || alert.service || 'unknown',
        severity: alert.severity || 'medium',
        message: alert.message || '',
        metrics: {},
      })
      setDiagResult(res.data)
    } catch (err) {
      setDiagResult({ error: err.response?.data?.detail || 'AI Engine unavailable' })
    } finally {
      setDiagnosingId(null)
    }
  }

  const handleResolve = async (id) => {
    try {
      await resolveAlert(id)
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
    } catch {
      // ignore
    }
  }

  const statusButtons = ['all', 'open', 'resolved']
  const severityButtons = ['all', 'critical', 'high', 'medium', 'low']

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-[#0f172a] dark:text-gray-100">Alerts</h1>
        <span className="bg-[#dbeafe] dark:bg-blue-900/30 text-[#2563eb] dark:text-blue-400 text-xs font-bold px-2.5 py-1 rounded-full">
          {(alerts || []).length}
        </span>
        {isFetching && <span className="polling-dot" />}
      </div>

      {/* Filters */}
      <div className="bg-white/80 dark:bg-gray-800/60 backdrop-blur-md border border-white/20 dark:border-gray-700/50 rounded-2xl p-4 mb-4 transition-colors">
        <div className="flex flex-wrap items-center gap-4">
          {/* Status */}
          <div className="flex gap-1">
            {statusButtons.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-md capitalize transition-colors ${
                  statusFilter === s ? 'bg-[#2563eb] text-white' : 'bg-[#f1f5f9] dark:bg-gray-700 text-[#64748b] dark:text-gray-300 hover:bg-[#e2e8f0] dark:hover:bg-gray-600'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="w-px h-6 bg-[#e2e8f0] dark:bg-gray-700" />

          {/* Severity */}
          <div className="flex gap-1">
            {severityButtons.map((s) => (
              <button
                key={s}
                onClick={() => setSeverityFilter(s)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-md capitalize transition-colors ${
                  severityFilter === s ? 'bg-[#2563eb] text-white' : 'bg-[#f1f5f9] dark:bg-gray-700 text-[#64748b] dark:text-gray-300 hover:bg-[#e2e8f0] dark:hover:bg-gray-600'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search service..."
            className="text-sm px-3 py-1.5 border border-[#e2e8f0] dark:border-gray-600 rounded-md w-48 bg-white dark:bg-gray-700 text-[#0f172a] dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/80 dark:bg-gray-800/60 backdrop-blur-md border border-white/20 dark:border-gray-700/50 rounded-2xl p-4 transition-colors">
        {isLoading ? (
          <LoadingSpinner className="py-12" />
        ) : (
          <AlertsTable
            alerts={filtered}
            onDiagnose={handleDiagnose}
            onResolve={handleResolve}
            diagnosingId={diagnosingId}
          />
        )}
      </div>

      {/* Diagnosis result modal */}
      {diagResult && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setDiagResult(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-[#e2e8f0] dark:border-gray-700 max-w-lg w-full p-6 max-h-[80vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-[#0f172a] dark:text-gray-100 mb-4">AI Diagnosis</h2>
            {diagResult.error ? (
              <p className="text-red-600 dark:text-red-400 text-sm">{diagResult.error}</p>
            ) : (
              <div className="space-y-3 text-sm text-[#0f172a] dark:text-gray-100">
                {diagResult.simple_explanation && (
                  <div>
                    <p className="font-semibold text-xs text-[#64748b] dark:text-gray-400 uppercase mb-1">Summary</p>
                    <p>{diagResult.simple_explanation}</p>
                  </div>
                )}
                {diagResult.root_cause && (
                  <div>
                    <p className="font-semibold text-xs text-[#64748b] dark:text-gray-400 uppercase mb-1">Root Cause</p>
                    <p>{diagResult.root_cause}</p>
                  </div>
                )}
                {diagResult.fix_steps && (
                  <div>
                    <p className="font-semibold text-xs text-[#64748b] dark:text-gray-400 uppercase mb-1">Fix Steps</p>
                    <ol className="list-decimal pl-4 space-y-1">
                      {diagResult.fix_steps.map((step, i) => <li key={i}>{step}</li>)}
                    </ol>
                  </div>
                )}
              </div>
            )}
            <button onClick={() => setDiagResult(null)} className="mt-4 w-full py-2 bg-[#f1f5f9] dark:bg-gray-700 text-[#0f172a] dark:text-gray-100 text-sm font-semibold rounded-lg hover:bg-[#e2e8f0] dark:hover:bg-gray-600 transition-colors">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
