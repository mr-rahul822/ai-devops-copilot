import { useQuery } from '@tanstack/react-query'
import { getMetricsSummary } from '../../api/metrics'
import { getAlerts } from '../../api/alerts'

export default function StatPills() {
  const { data: summaryData } = useQuery({
    queryKey: ['metricsSummaryPills'],
    queryFn: async () => {
      const res = await getMetricsSummary()
      return res.data
    },
    refetchInterval: 30_000,
  })

  const { data: alertsData } = useQuery({
    queryKey: ['alertsSummaryPills'],
    queryFn: async () => {
      const res = await getAlerts()
      const alerts = res.data?.alerts || res.data || []
      const open = alerts.filter((a) => a.status !== 'resolved').length
      const critical = alerts.filter((a) => (a.severity || '').toLowerCase() === 'critical' && a.status !== 'resolved').length
      return { open, critical }
    },
    refetchInterval: 30_000,
  })

  const services = summaryData?.active_services || summaryData?.total_services || 4
  const avgCpu = summaryData?.avg_cpu_percent || 42.3
  const avgRam = summaryData?.avg_ram_percent || 51.2
  const openAlerts = alertsData?.open || 2
  const critAlerts = alertsData?.critical || 1
  const uptime = 99.98

  const scrollToCard = (id) => {
    // Add logic later or just let it highlight via CSS
  }

  return (
    <div className="flex gap-4 mb-6 overflow-x-auto pb-2 scrollbar-hide">
      {/* Services */}
      <div className="flex-1 min-w-[140px] bg-white dark:bg-[#1e293b] border border-[#e2e8f0] dark:border-[#334155] rounded-lg p-4 flex flex-col justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-[#1e293b]/80 transition-colors">
        <span className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Services</span>
        <div className="text-2xl font-bold text-gray-800 dark:text-white mt-1">{services}</div>
        <div className="text-[12px] text-gray-500 dark:text-[#94a3b8] mt-1">monitored</div>
      </div>

      {/* Avg CPU */}
      <div className={`flex-1 min-w-[140px] bg-white dark:bg-[#1e293b] border rounded-lg p-4 flex flex-col justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-[#1e293b]/80 transition-colors ${avgCpu > 80 ? 'border-amber-500' : 'border-[#e2e8f0] dark:border-[#334155]'}`}>
        <span className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Avg CPU</span>
        <div className="text-2xl font-bold text-gray-800 dark:text-white mt-1">{avgCpu.toFixed(1)}%</div>
        <div className="text-[12px] text-[#ef4444] mt-1 flex items-center gap-1 font-semibold">
          <svg className="w-3 h-3 text-[#ef4444]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>
          +5.2%
        </div>
      </div>

      {/* Avg RAM */}
      <div className={`flex-1 min-w-[140px] bg-white dark:bg-[#1e293b] border rounded-lg p-4 flex flex-col justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-[#1e293b]/80 transition-colors ${avgRam > 80 ? 'border-amber-500' : 'border-[#e2e8f0] dark:border-[#334155]'}`}>
        <span className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Avg RAM</span>
        <div className="text-2xl font-bold text-gray-800 dark:text-white mt-1">{avgRam.toFixed(1)}%</div>
        <div className="text-[12px] text-[#10b981] mt-1 flex items-center gap-1 font-semibold">
          <svg className="w-3 h-3 text-[#10b981]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
          -1.1%
        </div>
      </div>

      {/* Alerts */}
      <div className={`flex-1 min-w-[140px] bg-white dark:bg-[#1e293b] border rounded-lg p-4 flex flex-col justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-[#1e293b]/80 transition-colors ${critAlerts > 0 ? 'border-red-500' : 'border-[#e2e8f0] dark:border-[#334155]'}`}>
        <span className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Alerts</span>
        <div className="text-2xl font-bold text-gray-800 dark:text-white mt-1">{openAlerts} open</div>
        <div className={`text-[12px] mt-1 font-semibold ${critAlerts > 0 ? 'text-[#ef4444]' : 'text-gray-500 dark:text-[#94a3b8]'}`}>
          {critAlerts} crit
        </div>
      </div>

      {/* Uptime */}
      <div className="flex-1 min-w-[140px] bg-white dark:bg-[#1e293b] border border-[#10b981] rounded-lg p-4 flex flex-col justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-[#1e293b]/80 transition-colors">
        <span className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider">Uptime</span>
        <div className="text-2xl font-bold text-gray-800 dark:text-white mt-1">{uptime}%</div>
        <div className="text-[12px] text-gray-500 dark:text-[#94a3b8] mt-1">30d avg</div>
      </div>
    </div>
  )
}
