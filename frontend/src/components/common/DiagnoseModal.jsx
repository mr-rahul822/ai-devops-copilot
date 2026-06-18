import { useState, useEffect } from 'react'
import { analyzeIncident } from '../../api/ai'
import { executeAction } from '../../api/actions'

export default function DiagnoseModal({ isOpen, onClose, serviceName }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [actionCreating, setActionCreating] = useState(false)
  const [actionCreated, setActionCreated] = useState(false)

  useEffect(() => {
    if (isOpen && serviceName) {
      setLoading(true)
      setResult(null)
      setError(null)
      setActionCreated(false)

      analyzeIncident({
        service_name: serviceName,
        metrics: { context: "High CPU/RAM detected on dashboard" },
        logs: ["User clicked Diagnose from Dashboard"]
      })
      .then(res => {
        setResult(res.data)
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

  const handleCreateAction = async () => {
    if (!result) return
    setActionCreating(true)
    try {
      await executeAction({
        service_name: serviceName,
        action_type: 'AI_REMEDIATION',
        command: result.fix_steps?.[0] || 'Restart service'
      })
      setActionCreated(true)
    } catch (err) {
      alert("Failed to create action")
    } finally {
      setActionCreating(false)
    }
  }

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
              <div className="flex items-center justify-between">
                <span className={`px-3 py-1 text-[11px] font-bold uppercase tracking-wide rounded-full border ${
                  result.severity === 'critical' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                  result.severity === 'warning' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                  'bg-blue-500/10 border-blue-500/30 text-blue-400'
                }`}>
                  Severity: {result.severity || 'Medium'}
                </span>
                <span className="text-gray-600 dark:text-[#64748b] text-[12px]">Confidence: {result.confidence || '95%'}</span>
              </div>

              <div>
                <h3 className="text-[11px] font-bold text-[#64748b] dark:text-gray-400 uppercase tracking-wider mb-2">Root Cause</h3>
                <div className="bg-gray-50 dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#334155] rounded-lg p-4 text-[#475569] dark:text-[#cbd5e1] text-[14px] leading-relaxed">
                  {result.root_cause || result.simple_explanation || "Unable to determine exact root cause."}
                </div>
              </div>

              <div>
                <h3 className="text-[11px] font-bold text-[#64748b] dark:text-gray-400 uppercase tracking-wider mb-2">Recommended Fix</h3>
                <div className="bg-gray-50 dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#334155] rounded-lg p-4 text-[#475569] dark:text-[#cbd5e1] text-[14px] leading-relaxed">
                  <ul className="list-disc list-inside space-y-1">
                    {result.fix_steps ? result.fix_steps.map((step, i) => (
                      <li key={i}>{step}</li>
                    )) : <li>No specific fix steps provided.</li>}
                  </ul>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="px-6 py-4 border-t border-[#e2e8f0] dark:border-[#334155] bg-gray-50 dark:bg-[#0f172a] flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-[13px] font-bold text-[#64748b] dark:text-[#94a3b8] hover:text-gray-800 dark:hover:text-white transition-colors">
            Cancel
          </button>
          <button 
            onClick={handleCreateAction}
            disabled={!result || loading || actionCreating || actionCreated}
            className={`px-4 py-2 rounded-lg text-[13px] font-bold text-white transition-colors flex items-center gap-2 ${
              actionCreated ? 'bg-green-600' :
              !result || loading ? 'bg-[#3b82f6]/50 cursor-not-allowed' : 'bg-[#3b82f6] hover:bg-[#2563eb]'
            }`}
          >
            {actionCreated ? 'Action Created' : actionCreating ? 'Creating...' : 'Create Action'}
          </button>
        </div>

      </div>
    </div>
  )
}
