import StatusBadge from '../common/StatusBadge'
import { timeAgo } from '../../utils/formatters'

function getRiskLevel(actionType) {
  const type = (actionType || '').toLowerCase()
  if (type.includes('reboot') || type.includes('terminate') || type.includes('delete') || type.includes('update_asg')) return 'high'
  if (type.includes('restart') || type.includes('scale')) return 'moderate'
  return 'safe'
}

function getSourceType(action) {
  const target = (action.target_service || action.target || '').toLowerCase()
  if (target.includes('aws') || target.includes('ec2') || target.includes('rds') || target.includes('s3')) return 'aws'
  return 'docker'
}

const riskChipClasses = {
  safe: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  moderate: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  high: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
}

export default function ActionsTable({ actions = [], onViewDetails }) {
  if (actions.length === 0) {
    return (
      <div className="text-center py-12 text-[#64748b] dark:text-gray-400 text-sm">
        No actions recorded yet.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#e2e8f0] dark:border-gray-700">
            <th className="text-left text-[10px] font-bold tracking-[0.1em] text-[#64748b] dark:text-gray-400 uppercase py-3 pr-4">Action</th>
            <th className="text-left text-[10px] font-bold tracking-[0.1em] text-[#64748b] dark:text-gray-400 uppercase py-3 pr-4">Service</th>
            <th className="text-left text-[10px] font-bold tracking-[0.1em] text-[#64748b] dark:text-gray-400 uppercase py-3 pr-4">Status</th>
            <th className="text-left text-[10px] font-bold tracking-[0.1em] text-[#64748b] dark:text-gray-400 uppercase py-3 pr-4">Risk</th>
            <th className="text-left text-[10px] font-bold tracking-[0.1em] text-[#64748b] dark:text-gray-400 uppercase py-3 pr-4">Time</th>
            <th className="text-right text-[10px] font-bold tracking-[0.1em] text-[#64748b] dark:text-gray-400 uppercase py-3">Details</th>
          </tr>
        </thead>
        <tbody>
          {actions.map((action) => {
            const risk = getRiskLevel(action.action_type)
            const source = getSourceType(action)
            return (
              <tr
                key={action.id || action.action_id}
                className={`border-b border-[#f1f5f9] dark:border-gray-700 hover:bg-[#f8fafc] dark:hover:bg-gray-700/30 transition-colors border-l-4 ${
                  source === 'aws' ? 'border-l-orange-400' : 'border-l-blue-400'
                }`}
              >
                <td className="py-3 pr-4 font-semibold text-[#0f172a] dark:text-gray-100 text-xs">{action.action_type}</td>
                <td className="py-3 pr-4 text-[#64748b] dark:text-gray-400 text-xs">{action.target_service}</td>
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-1.5">
                    {action.status === 'EXECUTING' && <span className="polling-dot" />}
                    <StatusBadge status={action.status} />
                  </div>
                </td>
                <td className="py-3 pr-4">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded tracking-wider uppercase ${riskChipClasses[risk]}`}>
                    {risk === 'safe' ? 'Safe' : risk === 'moderate' ? 'Moderate' : 'High Risk'}
                  </span>
                </td>
                <td className="py-3 pr-4 text-[#64748b] dark:text-gray-400 text-xs whitespace-nowrap">{timeAgo(action.created_at)}</td>
                <td className="py-3 text-right">
                  <button
                    onClick={() => onViewDetails(action)}
                    className="text-[11px] font-semibold text-[#2563eb] border border-[#2563eb] px-3 py-1.5 rounded-md hover:bg-[#2563eb] hover:text-white transition-colors"
                  >
                    Details
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
