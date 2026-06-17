import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getActions, approveAction, rejectAction } from '../api/actions'

// Risk classification based on action type
function getRiskLevel(actionType) {
  const type = (actionType || '').toLowerCase()
  const safe = ['fetch_logs', 'get_status', 'describe_instances', 'describe_services', 'list_pods', 'fetch_container_logs']
  const moderate = ['restart_container', 'scale_service', 'restart_pod', 'scale_replica']
  const high = ['reboot_instance', 'terminate_instance', 'update_asg', 'delete_pod', 'force_stop']

  if (high.some(h => type.includes(h))) return 'high'
  if (moderate.some(m => type.includes(m))) return 'moderate'
  if (safe.some(s => type.includes(s))) return 'safe'
  if (type.includes('reboot') || type.includes('terminate') || type.includes('delete')) return 'high'
  if (type.includes('restart') || type.includes('scale')) return 'moderate'
  return 'safe'
}

function getSourceType(action) {
  const target = (action.target_service || action.target || '').toLowerCase()
  if (target.includes('aws') || target.includes('ec2') || target.includes('rds') || target.includes('s3')) return 'aws'
  return 'docker'
}

function formatTime(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const statusColors = {
  PENDING_APPROVAL: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  APPROVED: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  EXECUTING: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400',
  COMPLETED: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  FAILED: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  REJECTED: 'bg-gray-100 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400',
}

export default function Actions() {
  const [selectedActionId, setSelectedActionId] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null)
  const [confirmText, setConfirmText] = useState('')
  const queryClient = useQueryClient()

  // Fetch real actions from backend
  const { data: actionsData, isLoading, error } = useQuery({
    queryKey: ['actions'],
    queryFn: async () => {
      const res = await getActions({ limit: 50 })
      return res.data
    },
    refetchInterval: 15_000,
  })

  const actions = actionsData?.actions || []
  const activeAction = actions.find(a => a.id === selectedActionId) || actions[0]

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: (actionId) => approveAction(actionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actions'] })
    },
  })

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: (actionId) => rejectAction(actionId, 'Rejected by user'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actions'] })
    },
  })

  const handleApprove = (action) => {
    const risk = getRiskLevel(action.action_type)
    if (risk === 'high') {
      setConfirmAction(action)
      setConfirmText('')
    } else {
      approveMutation.mutate(action.id)
    }
  }

  const handleConfirmExecute = () => {
    approveMutation.mutate(confirmAction.id)
    setConfirmAction(null)
    setConfirmText('')
  }

  const handleReject = (action) => {
    rejectMutation.mutate(action.id)
  }

  const riskChipClasses = {
    safe: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    moderate: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
    high: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  }

  return (
    <div className="max-w-[1200px] mx-auto h-[calc(100vh-100px)] flex flex-col">
      {/* Header */}
      <div className="mb-6 shrink-0">
        <h1 className="text-2xl font-bold text-[#0f172a] dark:text-gray-100">Pending AI Actions</h1>
        <p className="text-[13px] text-[#64748b] dark:text-gray-400 mt-1">Review and approve automated remediation steps.</p>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-hidden">
        
        {/* Left Column: Actions Table */}
        <div className="bg-white/80 dark:bg-gray-800/60 backdrop-blur-md border border-white/20 dark:border-gray-700/50 rounded-2xl shadow-sm overflow-hidden flex flex-col transition-colors">
          <div className="p-4 border-b border-[#e2e8f0] dark:border-gray-700 bg-[#f8fafc] dark:bg-gray-800/80 flex items-center justify-between">
            <h2 className="text-[15px] font-bold text-[#0f172a] dark:text-gray-100">Action Queue</h2>
            <span className="text-[11px] font-mono text-[#64748b] dark:text-gray-400">
              {actions.length} total
            </span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-32 text-[#64748b] dark:text-gray-400 text-sm">
                Loading actions...
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-32 text-red-500 text-sm">
                Failed to load actions
              </div>
            ) : actions.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-[#64748b] dark:text-gray-400 text-sm">
                No actions yet. Run an AI analysis to generate recommended actions.
              </div>
            ) : (
              <table className="w-full text-left text-[13px]">
                <thead className="bg-white dark:bg-gray-800 sticky top-0 border-b border-[#e2e8f0] dark:border-gray-700 z-10">
                  <tr>
                    <th className="py-3 px-5 text-[11px] font-bold text-[#64748b] dark:text-gray-400 uppercase tracking-wider font-mono">Target</th>
                    <th className="py-3 px-5 text-[11px] font-bold text-[#64748b] dark:text-gray-400 uppercase tracking-wider font-mono">Action</th>
                    <th className="py-3 px-5 text-[11px] font-bold text-[#64748b] dark:text-gray-400 uppercase tracking-wider font-mono">Risk</th>
                    <th className="py-3 px-5 text-[11px] font-bold text-[#64748b] dark:text-gray-400 uppercase tracking-wider font-mono text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {actions.map((action) => {
                    const risk = getRiskLevel(action.action_type)
                    const source = getSourceType(action)
                    const isSelected = (activeAction?.id === action.id)
                    return (
                      <tr 
                        key={action.id} 
                        onClick={() => setSelectedActionId(action.id)}
                        className={`cursor-pointer border-b border-[#e2e8f0] dark:border-gray-700 last:border-0 transition-colors border-l-4 ${
                          source === 'aws' ? 'border-l-orange-400' : 'border-l-blue-400'
                        } ${
                          isSelected ? 'bg-[#f1f5f9] dark:bg-gray-700/50' : 'hover:bg-[#f8fafc] dark:hover:bg-gray-700/30'
                        }`}
                      >
                        <td className="py-4 px-5">
                          <div className="font-semibold text-[#0f172a] dark:text-gray-100">{action.target_service}</div>
                          {action.incident_id && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#eff6ff] dark:bg-[#1e3a5f] text-[#2563eb] dark:text-blue-400 border border-[#2563eb]/20 mt-1">
                              ✦ AI Recommended
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-5 text-[#475569] dark:text-gray-300 font-mono text-[12px]">{action.action_type}</td>
                        <td className="py-4 px-5">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold tracking-wider uppercase ${riskChipClasses[risk]}`}>
                            {risk === 'safe' ? 'Safe' : risk === 'moderate' ? 'Moderate' : 'High Risk'}
                          </span>
                        </td>
                        <td className="py-4 px-5 text-right">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${statusColors[action.status] || 'bg-gray-100 text-gray-500'}`}>
                            {action.status?.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right Column: Action Details */}
        <div className="bg-white/80 dark:bg-gray-800/60 backdrop-blur-md border border-white/20 dark:border-gray-700/50 rounded-2xl shadow-sm flex flex-col overflow-hidden transition-colors">
          <div className="p-5 border-b border-[#e2e8f0] dark:border-gray-700 bg-[#f8fafc] dark:bg-gray-800/80 flex justify-between items-center shrink-0">
            <h2 className="text-[17px] font-bold text-[#0f172a] dark:text-gray-100">Action Details</h2>
            {activeAction && (
              <span className={`px-2 py-0.5 rounded text-[11px] font-bold tracking-wider uppercase ${statusColors[activeAction.status] || 'bg-gray-100 text-gray-500'}`}>
                {activeAction.status?.replace('_', ' ')}
              </span>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
            {activeAction ? (
              <>
                <div>
                  <h3 className="text-[18px] font-bold text-[#0f172a] dark:text-gray-100 mb-1">
                    {activeAction.action_type}
                  </h3>
                  <p className="text-[14px] text-[#475569] dark:text-gray-300">
                    Target: <span className="font-mono font-semibold">{activeAction.target_service}</span>
                  </p>
                  {activeAction.incident_id && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#eff6ff] dark:bg-[#1e3a5f] text-[#2563eb] dark:text-blue-400 border border-[#2563eb]/20">
                        ✦ AI Recommended
                      </span>
                      <p className="text-[11px] text-[#94a3b8]">
                        Recommended by AI analysis · Outcome will improve future diagnoses
                      </p>
                    </div>
                  )}
                </div>

                {/* Parameters */}
                {activeAction.params && Object.keys(activeAction.params).length > 0 && (
                  <div>
                    <h4 className="text-[12px] font-bold text-[#64748b] dark:text-gray-400 uppercase tracking-wider mb-3">Parameters</h4>
                    <div className="bg-[#0f172a] rounded-lg p-4 font-mono text-[13px] leading-relaxed overflow-x-auto">
                      {Object.entries(activeAction.params).map(([key, val]) => (
                        <div key={key} className="text-gray-300">
                          <span className="text-[#93c5fd]">{key}</span>
                          <span className="text-gray-500">: </span>
                          <span className="text-[#86efac]">{JSON.stringify(val)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Result (if completed/failed) */}
                {activeAction.result && (
                  <div>
                    <h4 className="text-[12px] font-bold text-[#64748b] dark:text-gray-400 uppercase tracking-wider mb-3">Result</h4>
                    <div className="bg-[#0f172a] rounded-lg p-4 font-mono text-[12px] leading-relaxed overflow-x-auto max-h-48 overflow-y-auto">
                      <pre className="text-gray-300 whitespace-pre-wrap">{JSON.stringify(activeAction.result, null, 2)}</pre>
                    </div>
                  </div>
                )}

                {/* Error message */}
                {activeAction.error_message && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg p-3">
                    <h4 className="text-[12px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-1">Error</h4>
                    <p className="text-[13px] text-red-700 dark:text-red-300">{activeAction.error_message}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="border border-[#e2e8f0] dark:border-gray-700 rounded-lg p-3">
                    <span className="text-[11px] font-bold text-[#64748b] dark:text-gray-400 uppercase tracking-wider">Executor</span>
                    <p className="text-[14px] font-bold text-[#0f172a] dark:text-gray-100 mt-1 capitalize">{activeAction.executor_type}</p>
                  </div>
                  <div className="border border-[#e2e8f0] dark:border-gray-700 rounded-lg p-3">
                    <span className="text-[11px] font-bold text-[#64748b] dark:text-gray-400 uppercase tracking-wider">Risk Level</span>
                    <p className="text-[14px] font-bold text-[#0f172a] dark:text-gray-100 mt-1 capitalize">{activeAction.risk_level}</p>
                  </div>
                  <div className="border border-[#e2e8f0] dark:border-gray-700 rounded-lg p-3">
                    <span className="text-[11px] font-bold text-[#64748b] dark:text-gray-400 uppercase tracking-wider">Created</span>
                    <p className="text-[13px] font-semibold text-[#0f172a] dark:text-gray-100 mt-1">{formatTime(activeAction.created_at)}</p>
                  </div>
                  <div className="border border-[#e2e8f0] dark:border-gray-700 rounded-lg p-3">
                    <span className="text-[11px] font-bold text-[#64748b] dark:text-gray-400 uppercase tracking-wider">Completed</span>
                    <p className="text-[13px] font-semibold text-[#0f172a] dark:text-gray-100 mt-1">{formatTime(activeAction.completed_at)}</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-[#64748b] dark:text-gray-400 text-sm">
                Select an action to view details
              </div>
            )}
          </div>

          {/* Action buttons — only show for PENDING_APPROVAL */}
          {activeAction?.status === 'PENDING_APPROVAL' && (
            <div className="p-4 border-t border-[#e2e8f0] dark:border-gray-700 bg-[#f8fafc] dark:bg-gray-800/80 flex justify-end gap-3 shrink-0">
              <button
                onClick={() => handleReject(activeAction)}
                disabled={rejectMutation.isPending}
                className="bg-white dark:bg-gray-700 border border-[#e2e8f0] dark:border-gray-600 text-[#475569] dark:text-gray-300 px-6 py-2 rounded text-[13px] font-medium hover:bg-[#f1f5f9] dark:hover:bg-gray-600 shadow-sm transition-colors disabled:opacity-50"
              >
                Reject
              </button>
              <button
                onClick={() => handleApprove(activeAction)}
                disabled={approveMutation.isPending}
                className="bg-[#16a34a] text-white px-6 py-2 rounded text-[13px] font-medium hover:bg-[#15803d] shadow-sm transition-colors disabled:opacity-50"
              >
                {approveMutation.isPending ? 'Executing...' : 'Approve & Execute'}
              </button>
            </div>
          )}
        </div>
        
      </div>

      {/* High Risk Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-[#e2e8f0] dark:border-gray-700 max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">⚠</span>
              <h2 className="text-lg font-bold text-[#ef4444]">High Risk Action</h2>
            </div>

            <div className="space-y-2 mb-4 text-sm text-[#0f172a] dark:text-gray-100">
              <p>This will execute: <strong>{confirmAction.action_type}</strong> on <strong>{confirmAction.target_service}</strong></p>
              <p className="text-[#64748b] dark:text-gray-400 text-xs">
                This action directly modifies your cloud infrastructure and cannot be undone.
              </p>
            </div>

            <div className="mb-4">
              <label className="text-xs font-bold text-[#64748b] dark:text-gray-400 uppercase tracking-wider">Type CONFIRM to proceed</label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-[#e2e8f0] dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-[#0f172a] dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#ef4444] focus:border-transparent"
                placeholder="CONFIRM"
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setConfirmAction(null); setConfirmText('') }}
                className="flex-1 py-2.5 bg-[#f1f5f9] dark:bg-gray-700 text-[#0f172a] dark:text-gray-100 font-semibold text-sm rounded-lg hover:bg-[#e2e8f0] dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmExecute}
                disabled={confirmText !== 'CONFIRM'}
                className="flex-1 py-2.5 bg-[#ef4444] text-white font-semibold text-sm rounded-lg hover:bg-[#dc2626] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Execute
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
