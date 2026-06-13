import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'

export default function NetworkChart({ data }) {
  return (
    <div className="w-full h-[220px]">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart data={data} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
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
            yAxisId="left"
            stroke="#64748b" 
            tick={{ fill: '#64748b', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(val) => `${val} req/s`}
          />
          <YAxis 
            yAxisId="right"
            orientation="right"
            stroke="#64748b" 
            tick={{ fill: '#64748b', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(val) => `${val} MB/s`}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'rgba(15, 23, 42, 0.95)', 
              borderColor: '#334155', 
              borderRadius: '8px',
              color: '#f8fafc',
              fontSize: '12px'
            }}
            itemStyle={{ fontSize: '12px', fontWeight: 500 }}
          />

          <Line 
            yAxisId="left"
            type="monotone" 
            dataKey="requests" 
            name="Requests" 
            stroke="#10b981" 
            strokeWidth={2} 
            dot={false}
            isAnimationActive={false}
          />
          <Line 
            yAxisId="right"
            type="monotone" 
            dataKey="throughput" 
            name="Throughput" 
            stroke="#0ea5e9" 
            strokeWidth={2} 
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
