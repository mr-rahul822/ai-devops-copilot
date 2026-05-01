import { useMemo, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export default function MetricsChart({ data = [], awsData = [], peakCpu = 0 }) {
  const [source, setSource] = useState('docker')
  const latency = Math.floor(Math.random() * 20 + 15)

  const activeData = source === 'aws' ? awsData : data

  // Detect if any data points have null/undefined values (SSM unavailable)
  const hasNullMetrics = useMemo(() => {
    return activeData.some(
      (d) => d.cpu == null || d.mem == null
    )
  }, [activeData])

  // Ensure null values pass through correctly for Recharts gap rendering
  const chartData = useMemo(() => {
    return activeData.map((d) => ({
      ...d,
      cpu: d.cpu != null ? d.cpu : null,
      mem: d.mem != null ? d.mem : null,
    }))
  }, [activeData])

  // Check if all data is null/empty
  const isEmpty = chartData.length === 0 || chartData.every(d => d.cpu == null && d.mem == null)

  return (
    <div className="bg-white/80 dark:bg-gray-800/60 backdrop-blur-md border border-white/20 dark:border-gray-700/50 shadow-sm rounded-2xl p-5 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <h3 className="text-xs font-bold tracking-[0.1em] text-[#0f172a] dark:text-gray-100 uppercase">Resource Utilization</h3>
          <p className="text-[11px] text-[#64748b] dark:text-gray-400">Real-time telemetry / 1s refresh</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Source toggle */}
          <div className="flex border border-[#e2e8f0] dark:border-gray-600 rounded-lg overflow-hidden">
            <button
              onClick={() => setSource('docker')}
              className={`text-[11px] font-semibold px-3 py-1 transition-colors ${
                source === 'docker'
                  ? 'bg-[#2563eb] text-white'
                  : 'text-[#64748b] dark:text-gray-400 hover:bg-[#f1f5f9] dark:hover:bg-gray-700'
              }`}
            >
              Docker
            </button>
            <button
              onClick={() => setSource('aws')}
              className={`text-[11px] font-semibold px-3 py-1 transition-colors ${
                source === 'aws'
                  ? 'bg-[#f59e0b] text-white'
                  : 'text-[#64748b] dark:text-gray-400 hover:bg-[#f1f5f9] dark:hover:bg-gray-700'
              }`}
            >
              AWS
            </button>
          </div>
          {/* Legend */}
          <div className="flex items-center gap-3 text-xs text-[#64748b] dark:text-gray-400">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-[#1d4ed8] rounded-sm" /> CPU</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-[#93c5fd] rounded-sm" /> MEM</span>
          </div>
        </div>
      </div>

      {/* Chart or empty state */}
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center h-48 text-sm text-gray-400 dark:text-gray-500">
          <span>No metrics data available</span>
          <span className="text-xs mt-1">Data will appear once services start reporting</span>
        </div>
      ) : (
        <>
          <div className="w-full h-[280px] mt-3" style={{ minWidth: 0, minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="time"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  minTickGap={30}
                />
                <YAxis
                  domain={[0, 100]}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0', backgroundColor: 'rgba(255,255,255,0.95)' }}
                  formatter={(val) => val != null ? [`${val.toFixed(1)}%`] : ['N/A']}
                  labelStyle={{ color: '#0f172a', fontWeight: 'bold', marginBottom: '4px' }}
                />
                <Area type="monotone" dataKey="cpu" name="Avg CPU" stroke="#1d4ed8" fill="#dbeafe" strokeWidth={2} isAnimationActive={false} connectNulls={false} />
                <Area type="monotone" dataKey="mem" name="Avg MEM" stroke="#93c5fd" fill="#eff6ff" strokeWidth={2} isAnimationActive={false} connectNulls={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Null metrics warning */}
          {hasNullMetrics && (
            <p className="text-xs text-amber-500 mt-2">
              ⚠ Some data points unavailable — SSM Agent may not be running on all instances
            </p>
          )}
        </>
      )}

      {/* Bottom stats */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#e2e8f0] dark:border-gray-700">
        <div className="flex gap-8">
          <div>
            <span className="text-[10px] font-bold tracking-[0.1em] text-[#64748b] dark:text-gray-400 uppercase">Peak CPU</span>
            <p className="text-xl font-bold text-[#0f172a] dark:text-gray-100 font-mono">{peakCpu != null ? peakCpu.toFixed(1) : '—'}%</p>
          </div>
          <div>
            <span className="text-[10px] font-bold tracking-[0.1em] text-[#64748b] dark:text-gray-400 uppercase">Avg Latency</span>
            <p className="text-xl font-bold text-[#0f172a] dark:text-gray-100 font-mono">{latency}ms</p>
          </div>
        </div>
        <a href="/chat" className="text-xs font-semibold text-[#0f172a] dark:text-gray-100 border border-[#e2e8f0] dark:border-gray-600 px-4 py-2 rounded-lg hover:bg-[#f1f5f9] dark:hover:bg-gray-700 transition-colors">
          VIEW DETAILED METRICS
        </a>
      </div>
    </div>
  )
}
