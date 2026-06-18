import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getMetricsHistory } from '../api/metrics'

import StatPills from '../components/dashboard/StatPills'
import CombinedChart from '../components/dashboard/CombinedChart'
import MetricCard from '../components/dashboard/MetricCard'
import ServiceHealthCard from '../components/dashboard/ServiceHealthCard'
import LiveTerminal from '../components/dashboard/LiveTerminal'
import AISummary from '../components/dashboard/AISummary'
import AITimeline from '../components/dashboard/AITimeline'

export default function Dashboard() {
  const [timeFilter, setTimeFilter] = useState('1h')
  const [serviceFilter, setServiceFilter] = useState('All Services')

  const timeFilterValue = timeFilter === '1h' ? 1 : timeFilter === '6h' ? 6 : 24

  // Fetch history data for charts and health cards
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['metricsHistoryDashboard', timeFilterValue],
    queryFn: async () => {
      const res = await getMetricsHistory({ hours: timeFilterValue })
      return res.data?.history || res.data || []
    },
    refetchInterval: 60_000,
  })

  // Derive unique services for the dropdown
  const availableServices = useMemo(() => {
    if (!historyData || !Array.isArray(historyData)) return ['auth-service', 'metrics-service', 'alert-service', 'ai-engine']
    const srvs = new Set(historyData.map(d => d.service_name).filter(Boolean))
    return srvs.size > 0 ? Array.from(srvs) : ['auth-service', 'metrics-service', 'alert-service', 'ai-engine']
  }, [historyData])

  // Get latest stats per service for Health Cards
  const latestServiceStats = useMemo(() => {
    if (!historyData || !Array.isArray(historyData)) return []
    const latest = {}
    historyData.forEach(d => {
      if (!latest[d.service_name] || new Date(d.timestamp) > new Date(latest[d.service_name].timestamp)) {
        latest[d.service_name] = d
      }
    })
    return Object.values(latest)
  }, [historyData])

  // Calculate overall health
  const overallHealth = useMemo(() => {
    if (latestServiceStats.length === 0) return 'HEALTHY'
    let isWarning = false
    for (const stat of latestServiceStats) {
      const cpu = stat.cpu_percent || 0
      const ram = stat.ram_percent || 0
      if (cpu > 90 || ram > 90) return 'CRITICAL'
      if (cpu > 70 || ram > 80) isWarning = true
    }
    return isWarning ? 'WARNING' : 'HEALTHY'
  }, [latestServiceStats])

  return (
    <div className="max-w-[1400px] mx-auto pb-10">
      
      {/* SECTION 1: Top Header Row */}
      <div className="mb-6">


        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white tracking-tight">Dashboard</h1>
          
          <div className="flex items-center gap-3">
            {/* Time Filter */}
            <div className="flex items-center bg-white dark:bg-[#1e293b] rounded-lg border border-[#e2e8f0] dark:border-[#334155] p-1">
              {['1h', '6h', '24h'].map(t => (
                <button
                  key={t}
                  onClick={() => setTimeFilter(t)}
                  className={`px-3 py-1 rounded text-[12px] font-bold transition-colors ${
                    timeFilter === t ? 'bg-[#3b82f6] text-white' : 'text-[#64748b] dark:text-[#94a3b8] hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#334155]/50'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Service Filter */}
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="bg-white dark:bg-[#1e293b] border border-[#e2e8f0] dark:border-[#334155] text-gray-800 dark:text-white text-[13px] font-bold rounded-lg px-3 py-1.5 outline-none focus:border-[#3b82f6] min-w-[160px]"
            >
              <option value="All Services">All Services</option>
              {availableServices.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <button className="flex items-center gap-2 border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#1e293b] hover:bg-gray-100 dark:hover:bg-[#334155]/50 rounded-lg px-4 py-1.5 text-[13px] font-bold text-gray-800 dark:text-white shadow-sm transition-colors">
              <DownloadIcon /> Export Report
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 2: Stat Pills Row */}
      <StatPills />

      {/* SECTION 3: Big Combined Chart */}
      <div className="mb-6">
        <CombinedChart 
          data={historyData} 
          isLoading={historyLoading} 
          highlightedService={serviceFilter}
        />
      </div>

      {/* SECTION 4: 4 Individual Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard type="cpu" data={historyData} serviceFilter={serviceFilter} />
        <MetricCard type="memory" data={historyData} serviceFilter={serviceFilter} />
        <MetricCard type="disk" data={historyData} serviceFilter={serviceFilter} />
        <MetricCard type="network" data={historyData} serviceFilter={serviceFilter} />
      </div>

      {/* SECTION 5: Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (65%) */}
        <div className="lg:col-span-2 space-y-6 flex flex-col">
          
          <div className="bg-white dark:bg-[#1e293b] border border-[#e2e8f0] dark:border-[#334155] rounded-xl p-5 shadow-sm">
            <h2 className="text-[15px] font-bold text-gray-800 dark:text-white uppercase tracking-wider mb-4">Service Health Overview</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {availableServices.filter(s => serviceFilter === 'All Services' || s === serviceFilter).map(srv => {
                const stat = latestServiceStats.find(s => s.service_name === srv)
                return (
                  <ServiceHealthCard
                    key={srv}
                    serviceName={srv}
                    cpu={stat?.cpu_percent || 0}
                    ram={stat?.ram_percent || 0}
                    disk={stat?.disk_percent || 0}
                  />
                )
              })}
            </div>
          </div>

          <LiveTerminal serviceFilter={serviceFilter} />
          
        </div>

        {/* Right Column (35%) */}
        <div className="flex flex-col gap-6">
          <div className="flex-1">
            <AISummary overallHealth={overallHealth} />
          </div>
          <div className="flex-1 min-h-[350px]">
            <AITimeline />
          </div>
        </div>

      </div>

    </div>
  )
}

function DownloadIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  )
}
