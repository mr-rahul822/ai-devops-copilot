import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Dot } from 'recharts'
import { format } from 'date-fns'

const SERVICE_COLORS = {
  'auth-service': '#3b82f6',
  'metrics-service': '#22c55e',
  'alert-service': '#a855f7',
  'ai-engine': '#f59e0b'
}

const SERVICE_NAMES = {
  'auth-service': 'auth-service (us-east-1)',
  'metrics-service': 'metrics-service (us-east-1)',
  'alert-service': 'alert-service (us-east-1)',
  'ai-engine': 'ai-engine (us-east-1)'
}

const CustomizedDot = (props) => {
  const { cx, cy, value } = props
  if (value > 85) {
    return (
      <svg x={cx - 5} y={cy - 5} width={10} height={10} fill="red" viewBox="0 0 10 10">
        <circle cx="5" cy="5" r="4" stroke="none" />
      </svg>
    )
  }
  return null
}

export default function CombinedChart({ data, isLoading, highlightedService }) {
  const [hiddenServices, setHiddenServices] = useState({})

  const toggleService = (dataKey) => {
    setHiddenServices((prev) => ({
      ...prev,
      [dataKey]: !prev[dataKey]
    }))
  }

  // Transform data: group by timestamp, add micro-variations
  const chartData = useMemo(() => {
    if (!data || !Array.isArray(data)) return []
    
    const byTime = {}
    data.forEach(point => {
      const ts = new Date(point.timestamp).getTime()
      if (!byTime[ts]) byTime[ts] = { timestamp: ts }
      
      const srvName = point.service_name || 'unknown'
      const val = point.cpu_percent || 0
      // Micro-variation (+- 1%)
      let displayVal = val + (Math.random() - 0.5) * 2
      if (displayVal < 0) displayVal = 0
      if (displayVal > 100) displayVal = 100
      
      byTime[ts][srvName] = displayVal
    })
    
    return Object.values(byTime).sort((a, b) => a.timestamp - b.timestamp)
  }, [data])

  const activeServices = Object.keys(SERVICE_COLORS)

  if (isLoading) {
    return (
      <div className="h-[340px] w-full bg-white dark:bg-[#1e293b] border border-[#e2e8f0] dark:border-[#334155] rounded-xl flex items-center justify-center text-[#64748b]">
        Waiting for data...
      </div>
    )
  }

  return (
    <div className="w-full bg-white dark:bg-[#1e293b] rounded-xl border border-[#e2e8f0] dark:border-[#334155] p-5 shadow-lg">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-[14px] font-bold text-gray-800 dark:text-white uppercase tracking-wider">Combined Infrastructure Overview</h2>
          <p className="text-[12px] text-gray-600 dark:text-[#94a3b8]">Real-time aggregated view across all services</p>
        </div>
      </div>

      <div className="h-[340px] w-full">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={(ts) => format(new Date(ts), 'HH:mm')}
                stroke="var(--chart-axis)"
                tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                domain={[0, 100]}
                tickFormatter={(val) => `${val}%`}
                stroke="var(--chart-axis)"
                tick={{ fill: 'var(--chart-axis)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{ backgroundColor: 'var(--chart-tooltip-bg)', border: '1px solid var(--chart-tooltip-border)', borderRadius: '8px', color: 'var(--chart-tooltip-text)' }}
                labelFormatter={(label) => format(new Date(label), 'HH:mm:ss')}
                itemFormatter={(val, name) => [`${val.toFixed(1)}%`, SERVICE_NAMES[name] || name]}
              />
              <Legend 
                verticalAlign="top" 
                height={36} 
                iconType="circle"
                wrapperStyle={{ fontSize: '12px' }}
                onClick={(e) => toggleService(e.dataKey)}
                formatter={(value) => <span className="text-[#64748b] dark:text-var(--chart-legend-text) hover:text-[#0f172a] dark:hover:text-white font-medium cursor-pointer transition-colors" style={{ color: 'var(--chart-legend-text)' }}>{SERVICE_NAMES[value] || value}</span>}
              />
              <ReferenceLine y={85} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'Warning threshold', fill: '#ef4444', fontSize: 11 }} />
              
              {Object.keys(chartData[0] || {}).filter(k => k !== 'timestamp').map((srv, idx) => {
                const isHidden = hiddenServices[srv]
                const isFaded = highlightedService && highlightedService !== 'All Services' && highlightedService !== srv
                const opacity = isHidden ? 0 : (isFaded ? 0.2 : 1)
                
                // Fallback color if not in SERVICE_COLORS
                const fallbackColors = ['#ec4899', '#06b6d4', '#8b5cf6', '#f43f5e', '#10b981']
                const color = SERVICE_COLORS[srv] || fallbackColors[idx % fallbackColors.length]
                
                return (
                  <Line 
                    key={srv}
                    type="monotone" 
                    dataKey={srv} 
                    stroke={color} 
                    strokeWidth={2}
                    dot={<CustomizedDot />}
                    activeDot={{ r: 6 }}
                    isAnimationActive={false}
                    style={{ opacity }}
                  />
                )
              })}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full w-full flex items-center justify-center text-[#64748b]">
            No historical data available.
          </div>
        )}
      </div>
    </div>
  )
}
