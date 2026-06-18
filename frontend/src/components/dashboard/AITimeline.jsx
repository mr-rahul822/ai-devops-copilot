import { useQuery } from '@tanstack/react-query'
import { getActions } from '../../api/actions'
import { formatDistanceToNow } from 'date-fns'

export default function AITimeline() {
  const { data: actionsData, isLoading } = useQuery({
    queryKey: ['actionsTimeline'],
    queryFn: async () => {
      const res = await getActions({ limit: 5 })
      return res.data?.actions || res.data || []
    },
    refetchInterval: 15_000,
  })

  // Ensure we have some items to show, map to expected timeline format
  let items = (actionsData || []).map(act => ({
    id: act.id,
    title: act.command || act.action_type || 'Unknown Action',
    description: `Targeting ${act.service_name || act.service || 'infrastructure'}`,
    status: act.status || 'pending',
    time: act.created_at ? formatDistanceToNow(new Date(act.created_at), { addSuffix: true }) : 'Now'
  }))

  // Add mock data if empty for realism as requested
  if (items.length === 0 && !isLoading) {
    items = [
      { id: '1', title: 'Scaled RDS Replica', description: 'Automated response to latency spike in us-east-1.', status: 'completed', time: 'Now' },
      { id: '2', title: 'Suggested IAM Policy Update', description: 'Found overly permissive policy on dev-role.', status: 'pending', time: '45m ago', link: 'Review Policy' },
      { id: '3', title: 'Cache Purged', description: 'Automated routine cleanup for redis-cluster-2.', status: 'pending', time: '2h ago' }
    ]
  }

  return (
    <div className="bg-white dark:bg-[#1e293b] border border-[#e2e8f0] dark:border-[#334155] rounded-xl shadow-sm h-full flex flex-col">
      <div className="flex items-center gap-2 p-5 border-b border-[#e2e8f0] dark:border-[#334155]">
        <svg className="w-5 h-5 text-gray-800 dark:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h2 className="text-[17px] font-bold text-gray-800 dark:text-white">AI Action Timeline</h2>
      </div>
      
      <div className="p-5 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="text-[#64748b] text-[13px]">Loading timeline...</div>
        ) : (
          <div className="relative border-l-2 border-gray-200 dark:border-[#334155] ml-3 space-y-8 pb-4">
            
            {items.map((item, index) => {
              const isCompleted = item.status === 'completed'
              const dotClass = isCompleted 
                ? 'bg-[#3b82f6] border-4 border-white dark:border-[#1e293b]' 
                : 'bg-white dark:bg-[#1e293b] border-2 border-gray-300 dark:border-[#64748b]'

              return (
                <div key={item.id || index} className="relative pl-6">
                  <span className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full ${dotClass}`}></span>
                  <h3 className="text-[14px] font-bold text-gray-800 dark:text-white">{item.title}</h3>
                  <p className="text-[13px] text-gray-600 dark:text-[#94a3b8] mt-1 mb-1">{item.description}</p>
                  
                  {item.link && (
                    <a href="/actions" className="text-[12px] font-medium text-[#3b82f6] hover:underline flex items-center gap-1 mb-1">
                      {item.link}
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </a>
                  )}
                  
                  <span className="text-[11px] font-mono text-[#64748b]">{item.time}</span>
                </div>
              )
            })}

          </div>
        )}
      </div>

      <div className="p-4 border-t border-[#e2e8f0] dark:border-[#334155] bg-gray-50 dark:bg-[#0f172a] rounded-b-xl">
        <a href="/actions" className="text-[12px] font-bold text-[#3b82f6] hover:text-[#60a5fa] transition-colors flex items-center gap-1 justify-center">
          View All Actions
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </a>
      </div>
    </div>
  )
}
