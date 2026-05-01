import { useState } from 'react'

// Risk classification based on action type
function getRiskLevel(actionType) {
  const type = (actionType || '').toLowerCase()
  const safe = ['fetch_logs', 'get_status', 'describe_instances', 'describe_services', 'list_pods']
  const moderate = ['restart_container', 'scale_service', 'restart_pod', 'scale_replica']
  const high = ['reboot_instance', 'terminate_instance', 'update_asg', 'delete_pod', 'force_stop']

  if (high.some(h => type.includes(h))) return 'high'
  if (moderate.some(m => type.includes(m))) return 'moderate'
  if (safe.some(s => type.includes(s))) return 'safe'
  // Default based on keywords
  if (type.includes('reboot') || type.includes('terminate') || type.includes('delete')) return 'high'
  if (type.includes('restart') || type.includes('scale')) return 'moderate'
  return 'safe'
}

function getSourceType(action) {
  const target = (action.target_service || action.target || '').toLowerCase()
  if (target.includes('aws') || target.includes('ec2') || target.includes('rds') || target.includes('s3')) return 'aws'
  return 'docker'
}

export default function Actions() {
  const [selectedAction, setSelectedAction] = useState(1)
  const [confirmAction, setConfirmAction] = useState(null)
  const [confirmText, setConfirmText] = useState('')

  const mockActions = [
    { id: 1, target: 'Update IAM Policy', action: 'Remove Admin Access', action_type: 'update_asg', risk: 'High', eta: 'Immediate', target_service: 'aws-iam' },
    { id: 2, target: 'Scale RDS Replica', action: 'Increase to 4 nodes', action_type: 'scale_service', risk: 'Medium', eta: '5 mins', target_service: 'aws-rds' },
    { id: 3, target: 'Purge CDN Cache', action: 'Clear /assets/*', action_type: 'fetch_logs', risk: 'Low', eta: 'Immediate', target_service: 'cdn-edge' },
    { id: 4, target: 'Restart Pod', action: 'reporting-service-v2', action_type: 'restart_container', risk: 'Low', eta: '1 min', target_service: 'docker-reporting' },
  ]

  const activeAction = mockActions.find(a => a.id === selectedAction)

  const handleApprove = (action) => {
    const risk = getRiskLevel(action.action_type)
    if (risk === 'high') {
      setConfirmAction(action)
      setConfirmText('')
    } else {
      // Direct approve for safe/moderate
      alert(`Action "${action.target}" approved and executing.`)
    }
  }

  const handleConfirmExecute = () => {
    alert(`High-risk action "${confirmAction.target}" confirmed and executing.`)
    setConfirmAction(null)
    setConfirmText('')
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
          <div className="p-4 border-b border-[#e2e8f0] dark:border-gray-700 bg-[#f8fafc] dark:bg-gray-800/80">
            <h2 className="text-[15px] font-bold text-[#0f172a] dark:text-gray-100">Action Queue</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-white dark:bg-gray-800 sticky top-0 border-b border-[#e2e8f0] dark:border-gray-700 z-10">
                <tr>
                  <th className="py-3 px-5 text-[11px] font-bold text-[#64748b] dark:text-gray-400 uppercase tracking-wider font-mono">Target</th>
                  <th className="py-3 px-5 text-[11px] font-bold text-[#64748b] dark:text-gray-400 uppercase tracking-wider font-mono">Action</th>
                  <th className="py-3 px-5 text-[11px] font-bold text-[#64748b] dark:text-gray-400 uppercase tracking-wider font-mono">Risk</th>
                  <th className="py-3 px-5 text-[11px] font-bold text-[#64748b] dark:text-gray-400 uppercase tracking-wider font-mono text-right">ETA</th>
                </tr>
              </thead>
              <tbody>
                {mockActions.map((action) => {
                  const risk = getRiskLevel(action.action_type)
                  const source = getSourceType(action)
                  return (
                    <tr 
                      key={action.id} 
                      onClick={() => setSelectedAction(action.id)}
                      className={`cursor-pointer border-b border-[#e2e8f0] dark:border-gray-700 last:border-0 transition-colors border-l-4 ${
                        source === 'aws' ? 'border-l-orange-400' : 'border-l-blue-400'
                      } ${
                        selectedAction === action.id ? 'bg-[#f1f5f9] dark:bg-gray-700/50' : 'hover:bg-[#f8fafc] dark:hover:bg-gray-700/30'
                      }`}
                    >
                      <td className="py-4 px-5 font-semibold text-[#0f172a] dark:text-gray-100">{action.target}</td>
                      <td className="py-4 px-5 text-[#475569] dark:text-gray-300">{action.action}</td>
                      <td className="py-4 px-5">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold tracking-wider uppercase ${riskChipClasses[risk]}`}>
                          {risk === 'safe' ? 'Safe' : risk === 'moderate' ? 'Moderate' : 'High Risk'}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-[#64748b] dark:text-gray-400 text-right font-mono">{action.eta}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Action Details */}
        <div className="bg-white/80 dark:bg-gray-800/60 backdrop-blur-md border border-white/20 dark:border-gray-700/50 rounded-2xl shadow-sm flex flex-col overflow-hidden transition-colors">
          <div className="p-5 border-b border-[#e2e8f0] dark:border-gray-700 bg-[#f8fafc] dark:bg-gray-800/80 flex justify-between items-center shrink-0">
            <h2 className="text-[17px] font-bold text-[#0f172a] dark:text-gray-100">Action Details</h2>
            <span className="bg-[#fef2f2] dark:bg-red-900/30 text-[#ef4444] border border-[#ef4444]/20 px-2 py-0.5 rounded text-[11px] font-bold tracking-wider uppercase">Needs Approval</span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
            <div>
              <h3 className="text-[18px] font-bold text-[#0f172a] dark:text-gray-100 mb-1">{activeAction?.target}</h3>
              <p className="text-[14px] text-[#475569] dark:text-gray-300">{activeAction?.action}</p>
            </div>

            <div>
              <h4 className="text-[12px] font-bold text-[#64748b] dark:text-gray-400 uppercase tracking-wider mb-3">Proposed Changes</h4>
              <div className="bg-[#0f172a] rounded-lg p-4 font-mono text-[13px] leading-relaxed overflow-x-auto">
                <div className="text-gray-400 mb-2">@@ -14,6 +14,7 @@</div>
                <div className="text-[#ef4444] bg-[#ef4444]/10 px-2 rounded-sm">-    "Effect": "Allow",</div>
                <div className="text-[#ef4444] bg-[#ef4444]/10 px-2 rounded-sm">-    "Action": "s3:*",</div>
                <div className="text-[#16a34a] bg-[#16a34a]/10 px-2 rounded-sm mt-1">+    "Effect": "Allow",</div>
                <div className="text-[#16a34a] bg-[#16a34a]/10 px-2 rounded-sm">+    "Action": [</div>
                <div className="text-[#16a34a] bg-[#16a34a]/10 px-2 rounded-sm">+       "s3:GetObject",</div>
                <div className="text-[#16a34a] bg-[#16a34a]/10 px-2 rounded-sm">+       "s3:ListBucket"</div>
                <div className="text-[#16a34a] bg-[#16a34a]/10 px-2 rounded-sm">+    ],</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="border border-[#e2e8f0] dark:border-gray-700 rounded-lg p-3">
                <span className="text-[11px] font-bold text-[#64748b] dark:text-gray-400 uppercase tracking-wider">Estimated Downtime</span>
                <p className="text-[14px] font-bold text-[#0f172a] dark:text-gray-100 mt-1">None</p>
              </div>
              <div className="border border-[#e2e8f0] dark:border-gray-700 rounded-lg p-3">
                <span className="text-[11px] font-bold text-[#64748b] dark:text-gray-400 uppercase tracking-wider">Rollback Capability</span>
                <p className="text-[14px] font-bold text-[#16a34a] mt-1 flex items-center gap-1"><CheckIcon /> Supported</p>
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-[#e2e8f0] dark:border-gray-700 bg-[#f8fafc] dark:bg-gray-800/80 flex justify-end gap-3 shrink-0">
            <button className="bg-white dark:bg-gray-700 border border-[#e2e8f0] dark:border-gray-600 text-[#475569] dark:text-gray-300 px-6 py-2 rounded text-[13px] font-medium hover:bg-[#f1f5f9] dark:hover:bg-gray-600 shadow-sm transition-colors">
              Reject
            </button>
            <button
              onClick={() => activeAction && handleApprove(activeAction)}
              className="bg-[#16a34a] text-white px-6 py-2 rounded text-[13px] font-medium hover:bg-[#15803d] shadow-sm transition-colors"
            >
              Approve & Execute
            </button>
          </div>
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

function CheckIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
  )
}
