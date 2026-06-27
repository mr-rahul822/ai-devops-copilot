import { useState, useEffect } from 'react'
import { analyzeIncident } from '../../api/ai'

// ── Helper: extract user ID from JWT or store ──────────────────────────────
function getUserIdFromToken() {
  try {
    const token = localStorage.getItem('copilot_token')
    if (token) {
      const payload = JSON.parse(atob(token.split('.')[1]))
      return payload.userId || payload.user_id || payload.sub || 'anonymous'
    }
  } catch (e) {
    console.warn('[DiagnoseModal] Could not decode JWT:', e)
  }
  return 'anonymous'
}

export default function DiagnoseModal({ isOpen, onClose, serviceName }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isOpen && serviceName) {
      setLoading(true)
      setResult(null)
      setError(null)

      const userId = getUserIdFromToken()

      analyzeIncident({
        user_id: userId,
        service_name: serviceName,
        alert_type: 'ROUTINE_CHECK',
        raw_logs: `[INFO] User initiated diagnose for ${serviceName} from Dashboard.`,
        current_cpu: 0,
        current_ram: 0,
        metrics_history: [],
      })
      .then(res => {
        // The orchestrator returns: { decision: { severity, root_cause, fix_steps, ... }, ... }
        const data = res.data || {}
        const decision = data.decision || {}
        
        // Normalize the result for rendering
        setResult({
          severity: decision.severity || data.summary?.severity || 'UNKNOWN',
          confidence: decision.confidence != null ? `${Math.round(decision.confidence * 100)}%` : (data.summary?.confidence ? `${Math.round(data.summary.confidence * 100)}%` : 'N/A'),
          root_cause: decision.root_cause || data.root_cause || 'Unable to determine root cause.',
          simple_explanation: decision.simple_explanation || '',
          fix_steps: Array.isArray(decision.fix_steps) ? decision.fix_steps : (typeof decision.fix_steps === 'string' ? [decision.fix_steps] : ['No specific fix steps generated.']),
          recommended_action: decision.recommended_action || '',
          time_to_fix: decision.time_to_fix || '',
          is_partial: data.status === 'partial_diagnosis',
        })
      })
      .catch(err => {
        setError(err?.response?.data?.detail || err.message || "Failed to analyze service.")
      })
      .finally(() => {
        setLoading(false)
      })
    }
  }, [isOpen, serviceName])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#1e293b] border border-[#e2e8f0] dark:border-[#334155] rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e8f0] dark:border-[#334155] bg-gray-50 dark:bg-[#0f172a]">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-[#2563eb] dark:text-[#3b82f6] shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
            AI Diagnosis: {serviceName}
          </h2>
          <button onClick={onClose} className="text-[#64748b] dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-[#3b82f6]/30 border-t-[#3b82f6] rounded-full animate-spin mb-4"></div>
              <p className="text-gray-600 dark:text-[#94a3b8] animate-pulse">AI is analyzing telemetry and logs...</p>
            </div>
          ) : error ? (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
              {error}
            </div>
          ) : result ? (
            <div className="space-y-6">
              {result.is_partial && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-amber-400 text-[13px]">
                  ⚠️ Partial diagnosis — AI decision engine returned limited results. Consider running a full analysis from AI Insights.
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className={`px-3 py-1 text-[11px] font-bold uppercase tracking-wide rounded-full border ${
                  result.severity === 'CRITICAL' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                  result.severity === 'HIGH' ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' :
                  result.severity === 'MEDIUM' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                  result.severity === 'LOW' ? 'bg-green-500/10 border-green-500/30 text-green-400' :
                  'bg-blue-500/10 border-blue-500/30 text-blue-400'
                }`}>
                  Severity: {result.severity}
                </span>
                <span className="text-gray-600 dark:text-[#64748b] text-[12px]">Confidence: {result.confidence}</span>
              </div>

              <div>
                <h3 className="text-[11px] font-bold text-[#64748b] dark:text-gray-400 uppercase tracking-wider mb-2">Root Cause</h3>
                <div className="bg-gray-50 dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#334155] rounded-lg p-4 text-[#475569] dark:text-[#cbd5e1] text-[14px] leading-relaxed">
                  {result.root_cause}
                </div>
              </div>

              {result.simple_explanation && (
                <div>
                  <h3 className="text-[11px] font-bold text-[#64748b] dark:text-gray-400 uppercase tracking-wider mb-2">In Simple Terms</h3>
                  <div className="bg-gray-50 dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#334155] rounded-lg p-4 text-[#475569] dark:text-[#cbd5e1] text-[14px] leading-relaxed">
                    {result.simple_explanation}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-[11px] font-bold text-[#64748b] dark:text-gray-400 uppercase tracking-wider mb-2">Recommended Fix</h3>
                <div className="bg-gray-50 dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#334155] rounded-lg p-4 text-[#475569] dark:text-[#cbd5e1] text-[14px] leading-relaxed">
                  <ol className="list-decimal list-inside space-y-1">
                    {result.fix_steps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>
              </div>

              {result.time_to_fix && (
                <div className="flex items-center gap-2 text-[13px] text-[#64748b]">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Estimated fix time: <strong className="text-gray-800 dark:text-white">{result.time_to_fix}</strong></span>
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="px-6 py-4 border-t border-[#e2e8f0] dark:border-[#334155] bg-gray-50 dark:bg-[#0f172a] flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-[13px] font-bold text-[#64748b] dark:text-[#94a3b8] hover:text-gray-800 dark:hover:text-white transition-colors">
            Close
          </button>
        </div>

      </div>
    </div>
  )
}
