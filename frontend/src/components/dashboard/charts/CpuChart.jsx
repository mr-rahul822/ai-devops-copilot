import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
  ReferenceLine
} from 'recharts'

export default function CpuChart({ data, alerts, selectedService = 'All' }) {
  // Determine lines to render based on selection
  const showGlobal = selectedService === 'All'
  const showAuth = selectedService === 'All' || selectedService === 'auth-service'
  const showMetrics = selectedService === 'All' || selectedService === 'metrics-service'
  const showAlert = selectedService === 'All' || selectedService === 'alert-service'

  return (
    <div className="w-full h-[300px]">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart data={data} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} opacity={0.3} />
          <XAxis 
            dataKey="time" 
            stroke="#64748b" 
            tick={{ fill: '#64748b', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            minTickGap={30}
          />
          <YAxis 
            stroke="#64748b" 
            tick={{ fill: '#64748b', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            domain={[0, 100]}
            tickFormatter={(val) => `${val}%`}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'rgba(15, 23, 42, 0.95)', 
              borderColor: '#334155', 
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              color: '#f8fafc',
              fontSize: '12px'
            }}
            itemStyle={{ fontSize: '12px', fontWeight: 500 }}
            labelStyle={{ color: '#94a3b8', marginBottom: '4px', fontWeight: 600 }}
          />

          {/* Reference Line for 80% threshold */}
          <ReferenceLine y={80} stroke="#ef4444" strokeDasharray="3 3" opacity={0.5} />

          {/* Render Lines */}
          {showGlobal && (
            <Line 
              type="monotone" 
              dataKey="globalCpu" 
              name="Global CPU" 
              stroke="#3b82f6" 
              strokeWidth={3} 
              dot={false}
              activeDot={{ r: 6, fill: '#3b82f6', stroke: '#1e3a8a', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          )}
          {showAuth && (
            <Line 
              type="monotone" 
              dataKey="authCpu" 
              name="auth-service" 
              stroke="#8b5cf6" 
              strokeWidth={2} 
              dot={false}
              opacity={0.7}
              isAnimationActive={false}
            />
          )}
          {showMetrics && (
            <Line 
              type="monotone" 
              dataKey="metricsCpu" 
              name="metrics-service" 
              stroke="#10b981" 
              strokeWidth={2} 
              dot={false}
              opacity={0.7}
              isAnimationActive={false}
            />
          )}
          {showAlert && (
            <Line 
              type="monotone" 
              dataKey="alertCpu" 
              name="alert-service" 
              stroke="#f59e0b" 
              strokeWidth={2} 
              dot={false}
              opacity={0.7}
              isAnimationActive={false}
            />
          )}

          {/* Overlay Alerts as Reference Dots */}
          {alerts && alerts.map((alert, i) => {
            // Find the data point that matches this alert's time to overlay it correctly
            // If we don't have the exact CPU value for the dot's Y position, we can place it high
            const point = data.find(d => d.time === alert.time)
            const yVal = point ? point.globalCpu : 90
            
            return (
              <ReferenceDot 
                key={i} 
                x={alert.time} 
                y={yVal} 
                r={6} 
                fill="#ef4444" 
                stroke="#7f1d1d" 
                strokeWidth={2} 
                isFront={true}
              >
                {/* Custom tooltip logic for the dot can be handled in a custom shape if needed, 
                    but the standard tooltip will catch it if hovering nearby. */}
              </ReferenceDot>
            )
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
