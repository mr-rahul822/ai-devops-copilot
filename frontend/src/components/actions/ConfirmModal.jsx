import { useState } from 'react'

export default function ConfirmModal({ action, onConfirm, onCancel, loading }) {
  if (!action) return null

  const risk = action.risk_level || 'MEDIUM'
  const isHighRisk = risk === 'HIGH' || risk === 'CRITICAL'

  const [confirmText, setConfirmText] = useState('')

  const riskColors = {
    LOW: 'text-[#16a34a] bg-green-50 dark:bg-green-900/30',
    MEDIUM: 'text-[#f59e0b] bg-yellow-50 dark:bg-yellow-900/30',
    HIGH: 'text-[#ef4444] bg-red-50 dark:bg-red-900/30',
    CRITICAL: 'text-[#ef4444] bg-red-100 dark:bg-red-900/40',
  }
  const riskStyle = riskColors[risk] || riskColors.MEDIUM

  const canConfirm = isHighRisk ? confirmText === 'CONFIRM' : true

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-[#e2e8f0] dark:border-gray-700 max-w-md w-full p-6 shadow-2xl">
        {isHighRisk ? (
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">⚠</span>
            <h2 className="text-lg font-bold text-[#ef4444]">High Risk Action</h2>
          </div>
        ) : (
          <h2 className="text-lg font-bold text-[#0f172a] dark:text-gray-100 mb-2">Confirm Action</h2>
        )}

        <div className="space-y-3 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-[#64748b] dark:text-gray-400">Action</span>
            <span className="font-semibold text-[#0f172a] dark:text-gray-100">{action.action_type}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#64748b] dark:text-gray-400">Target</span>
            <span className="font-semibold text-[#0f172a] dark:text-gray-100">{action.target_service}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#64748b] dark:text-gray-400">Risk Level</span>
            <span className={`font-bold text-xs px-2 py-0.5 rounded ${riskStyle}`}>{risk}</span>
          </div>
        </div>

        {isHighRisk && (
          <>
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 text-xs px-3 py-2.5 rounded-lg mb-4">
              This action directly modifies your cloud infrastructure and cannot be undone.
            </div>
            <div className="mb-4">
              <label className="text-xs font-bold text-[#64748b] dark:text-gray-400 uppercase tracking-wider">Type CONFIRM to proceed</label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-[#e2e8f0] dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-[#0f172a] dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#ef4444] focus:border-transparent"
                placeholder="CONFIRM"
              />
            </div>
          </>
        )}

        {!isHighRisk && (action.action_type || '').includes('restart') && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300 text-xs px-3 py-2.5 rounded-lg mb-4">
            ⚠️ This will cause ~30s downtime for {action.target_service}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 bg-[#f1f5f9] dark:bg-gray-700 text-[#0f172a] dark:text-gray-100 font-semibold text-sm rounded-lg hover:bg-[#e2e8f0] dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading || !canConfirm}
            className={`flex-1 py-2.5 font-semibold text-sm rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${
              isHighRisk
                ? 'bg-[#ef4444] text-white hover:bg-[#dc2626]'
                : 'bg-[#16a34a] text-white hover:bg-[#15803d]'
            }`}
          >
            {loading ? 'Executing...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
