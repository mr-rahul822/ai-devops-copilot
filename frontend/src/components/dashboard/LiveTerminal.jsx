import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAlerts } from '../../api/alerts'
import { getActions } from '../../api/actions'
import { getLatestMetrics } from '../../api/metrics'
import { format } from 'date-fns'

export default function LiveTerminal({ serviceFilter }) {
  const [filter, setFilter] = useState('All')
  const bottomRef = useRef(null)

  const { data: alertsData } = useQuery({
    queryKey: ['alertsTerminal'],
    queryFn: async () => {
      const res = await getAlerts()
      return res.data?.alerts || res.data || []
    },
    refetchInterval: 15000,
  })

  const { data: actionsData } = useQuery({
    queryKey: ['actionsTerminal'],
    queryFn: async () => {
      const res = await getActions({ limit: 10 })
      return res.data?.actions || res.data || []
    },
    refetchInterval: 15000,
  })

  const { data: metricsData } = useQuery({
    queryKey: ['metricsTerminal'],
    queryFn: async () => {
      const res = await getLatestMetrics()
      return res.data?.metrics || res.data || []
    },
    refetchInterval: 15000,
  })

  // Combine and sort events
  const events = []
  
  // Real alert events
  if (alertsData && Array.isArray(alertsData)) {
    alertsData.forEach(a => {
      let tag = 'INFO'
      let color = 'bg-[#374151]'
      const sev = (a.severity || '').toLowerCase()
      if (sev === 'critical' || sev === 'error') {
        tag = 'ERROR'
        color = 'bg-[#dc2626]'
      } else if (sev === 'warning') {
        tag = 'WARN'
        color = 'bg-[#d97706]'
      }

      events.push({
        id: `alert-${a.id}`,
        timestamp: new Date(a.created_at).getTime(),
        tag,
        color,
        service: a.service_name || a.service || 'unknown',
        message: a.message || a.title
      })
    })
  }

  // Real action events
  if (actionsData && Array.isArray(actionsData)) {
    actionsData.forEach(act => {
      events.push({
        id: `action-${act.id}`,
        timestamp: new Date(act.created_at).getTime(),
        tag: 'AI-ACTION',
        color: 'bg-[#7c3aed]',
        service: act.service_name || act.service || 'ai-engine',
        message: `Executing: ${act.command || act.action_type}`
      })
      if (act.status === 'completed') {
        events.push({
          id: `action-${act.id}-success`,
          timestamp: new Date(act.updated_at || act.created_at).getTime() + 1000,
          tag: 'SUCCESS',
          color: 'bg-[#16a34a]',
          service: act.service_name || act.service || 'unknown',
          message: `Action completed successfully`
        })
      }
    })
  }

  // Real metric collection events
  if (metricsData && Array.isArray(metricsData)) {
    metricsData.forEach(m => {
      const cpu = m.cpu_percent ?? 0
      const ram = m.ram_percent ?? 0
      const disk = m.disk_percent ?? 0
      let tag, color, message

      if (cpu > 95 || ram > 95) {
        tag = 'ERROR'
        color = 'bg-[#dc2626]'
        message = `Critical resource spike on ${m.service_name}: CPU ${cpu.toFixed(1)}%, RAM ${ram.toFixed(1)}%`
      } else if (cpu > 80 || ram > 85) {
        tag = 'WARN'
        color = 'bg-[#d97706]'
        message = `High resource usage on ${m.service_name}: CPU ${cpu.toFixed(1)}%, RAM ${ram.toFixed(1)}%`
      } else {
        tag = 'INFO'
        color = 'bg-[#374151]'
        message = `Metrics collected for ${m.service_name}: CPU ${cpu.toFixed(1)}%, RAM ${ram.toFixed(1)}%, Disk ${disk.toFixed(1)}%`
      }

      events.push({
        id: `metric-${m.service_name}-${m.timestamp}`,
        timestamp: new Date(m.timestamp).getTime(),
        tag,
        color,
        service: `${m.source || 'aws'}-collector`,
        message,
      })
    })
  }

  events.sort((a, b) => a.timestamp - b.timestamp)

  const filteredEvents = events.filter(e => {
    if (serviceFilter && serviceFilter !== 'All Services' && e.service !== serviceFilter) return false
    if (filter === 'All') return true
    if (filter === 'AI Only') return e.tag === 'AI-AUDIT' || e.tag === 'AI-ACTION'
    if (filter === 'Errors') return e.tag === 'ERROR'
    if (filter === 'Warnings') return e.tag === 'WARN' || e.tag === 'ERROR'
    return true
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [filteredEvents.length])

  const handleDownload = () => {
    const text = filteredEvents.map(e => `[${format(e.timestamp, 'HH:mm:ss.SSS')}] [${e.tag}] ${e.service}:\n    ${e.message}`).join('\n\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'terminal-logs.txt'
    a.click()
  }

  return (
    <div className="flex flex-col h-[350px] bg-[#0d1117] border border-[#334155] rounded-xl overflow-hidden font-mono shadow-inner">
      <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-[#334155]">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-[12px] font-bold text-white uppercase tracking-wider">Live Event Stream</span>
        </div>
        <div className="flex items-center gap-3">
          <select 
            value={filter} 
            onChange={e => setFilter(e.target.value)}
            className="bg-[#0d1117] border border-[#334155] text-white text-[11px] rounded px-2 py-1 outline-none focus:border-[#3b82f6]"
          >
            <option value="All">All</option>
            <option value="AI Only">AI Only</option>
            <option value="Errors">Errors</option>
            <option value="Warnings">Warnings</option>
          </select>
          <button onClick={handleDownload} className="text-[#64748b] hover:text-white transition-colors" title="Download Logs">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 text-[12px] leading-relaxed scrollbar-thin scrollbar-thumb-[#334155] scrollbar-track-transparent">
        {filteredEvents.length === 0 ? (
          <div className="text-[#64748b]">No events yet — system is monitoring...</div>
        ) : (
          <div className="space-y-3">
            {filteredEvents.map((ev) => (
              <div key={ev.id} className="animate-fade-in-up">
                <div className="flex items-center gap-2">
                  <span className="text-[#6b7280]">[{format(ev.timestamp, 'HH:mm:ss.SSS')}]</span>
                  <span className={`${ev.color} text-white px-1.5 py-0.5 rounded-sm text-[10px] font-bold w-20 text-center inline-block`}>[{ev.tag}]</span>
                  <span className="text-[#94a3b8]">{ev.service}:</span>
                </div>
                <div className="text-[#cbd5e1] pl-[150px]">
                  {ev.message}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  )
}
