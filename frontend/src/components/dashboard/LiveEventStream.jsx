import { useState, useEffect } from 'react'
import { getLatestMetrics } from '../../api/metrics'
import { getAlerts } from '../../api/alerts'

// ── Helpers ──────────────────────────────────────────────────────────────────

const formatTime = (isoString) => {
  if (!isoString) return new Date().toTimeString().slice(0, 12).replace(' ', '.')
  try {
    const d = new Date(isoString)
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${d.getMilliseconds().toString().padStart(3, '0')}`
  } catch {
    return new Date().toTimeString().slice(0, 12)
  }
}

const metricsToEvents = (metrics) => {
  return (metrics || []).map((m) => {
    const cpu = m.cpu_percent ?? 0
    const ram = m.ram_percent ?? 0
    let type, color, message

    if (cpu > 95 || ram > 95) {
      type = 'ERROR'
      color = 'text-red-400'
      message = `Critical resource spike on ${m.service_name}: CPU ${cpu.toFixed(1)}%, RAM ${ram.toFixed(1)}%`
    } else if (cpu > 80 || ram > 85) {
      type = 'WARN'
      color = 'text-yellow-400'
      message = `High resource usage on ${m.service_name}: CPU ${cpu.toFixed(1)}%, RAM ${ram.toFixed(1)}%`
    } else {
      type = 'INFO'
      color = 'text-gray-400'
      message = `Metrics collected for ${m.service_name}: CPU ${cpu.toFixed(1)}%, RAM ${ram.toFixed(1)}%, Disk ${(m.disk_percent ?? 0).toFixed(1)}%`
    }

    return {
      id: `metric-${m.service_name}-${m.timestamp}`,
      time: formatTime(m.timestamp),
      type,
      source: `${m.source || 'aws'}-collector`,
      message,
      color,
    }
  })
}

const alertsToEvents = (alerts) => {
  return (alerts || []).map((a) => {
    const severityMap = {
      CRITICAL: { type: 'ERROR', color: 'text-red-400' },
      WARNING: { type: 'WARN', color: 'text-yellow-400' },
      INFO: { type: 'INFO', color: 'text-gray-400' },
    }
    const { type, color } = severityMap[a.severity] || { type: 'INFO', color: 'text-gray-400' }

    return {
      id: `alert-${a.id}`,
      time: formatTime(a.created_at),
      type,
      source: a.service_name || 'alert-engine',
      message: a.message || `${a.alert_type} alert triggered (value: ${a.metric_value}, threshold: ${a.threshold})`,
      color,
    }
  })
}

// ── Component ────────────────────────────────────────────────────────────────

const FILTER_OPTIONS = ['All', 'INFO', 'WARN', 'ERROR']

export default function LiveEventStream() {
  const [events, setEvents] = useState(null) // null = loading
  const [filter, setFilter] = useState('All')

  useEffect(() => {
    let cancelled = false

    const fetchEvents = async () => {
      try {
        const [metricsRes, alertsRes] = await Promise.allSettled([
          getLatestMetrics(),
          getAlerts({ status: 'open', limit: 10 }),
        ])

        if (cancelled) return

        const metrics =
          metricsRes.status === 'fulfilled'
            ? metricsRes.value?.data?.metrics || metricsRes.value?.data || []
            : []

        const alerts =
          alertsRes.status === 'fulfilled'
            ? alertsRes.value?.data?.alerts || alertsRes.value?.data || []
            : []

        const newMetricEvents = metricsToEvents(Array.isArray(metrics) ? metrics : [])
        const newAlertEvents = alertsToEvents(Array.isArray(alerts) ? alerts : [])
        const allNew = [...newAlertEvents, ...newMetricEvents].filter((e) => e.id)

        setEvents((prev) => {
          const existing = prev || []
          const existingIds = new Set(existing.map((e) => e.id))
          const trulyNew = allNew.filter((e) => !existingIds.has(e.id))

          if (trulyNew.length === 0 && prev !== null) return prev // no change

          const merged = [...trulyNew, ...existing]
          merged.sort((a, b) => b.time.localeCompare(a.time))
          return merged.slice(0, 15)
        })
      } catch (err) {
        setEvents((prev) => (prev === null ? [] : prev))
        console.warn('[LiveEventStream] Failed to fetch events:', err?.message)
      }
    }

    fetchEvents()
    const interval = setInterval(fetchEvents, 15_000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  const visibleEvents = filter === 'All' ? events || [] : (events || []).filter((e) => e.type === filter)

  return (
    <div className="bg-[#0f172a] h-[350px] flex flex-col font-mono text-[13px] relative group">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e293b] bg-[#0f172a] z-10 sticky top-0">
        <div className="flex items-center gap-3">
          <TerminalIcon />
          <h3 className="text-[#94a3b8] font-bold tracking-wider uppercase text-[11px]">Live Event Stream</h3>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-[#1e293b] text-[#94a3b8] text-[11px] border border-[#334155] rounded px-2 py-1 outline-none cursor-pointer hover:border-[#475569]"
          >
            {FILTER_OPTIONS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          <span className="text-green-500 text-[11px] font-bold tracking-widest uppercase">Live</span>
        </div>
      </div>

      {/* Terminal content */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar-dark space-y-2">
        {/* Loading state */}
        {events === null && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4 animate-pulse">
                <div className="h-4 w-24 bg-[#1e293b] rounded" />
                <div className="h-4 w-16 bg-[#1e293b] rounded" />
                <div className="h-4 w-20 bg-[#1e293b] rounded" />
                <div className="h-4 flex-1 bg-[#1e293b] rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {events !== null && visibleEvents.length === 0 && (
          <div className="flex items-center justify-center h-32 text-sm text-gray-400 dark:text-gray-500">
            No events yet — system is monitoring...
          </div>
        )}

        {/* Events list */}
        {events !== null &&
          visibleEvents.length > 0 &&
          visibleEvents.map((ev) => (
            <div key={ev.id} className="flex flex-col sm:flex-row gap-2 sm:gap-4 font-mono leading-tight">
              <span className="text-[#475569] shrink-0 whitespace-nowrap">[{ev.time}]</span>
              <span className={`w-20 shrink-0 font-bold ${ev.color}`}>[{ev.type}]</span>
              <span className="text-[#94a3b8] w-32 shrink-0 truncate">{ev.source}:</span>
              <span className="text-gray-300 break-all">{ev.message}</span>
            </div>
          ))}
      </div>

      {/* Decorative gradient overlay at bottom for fade out effect */}
      <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-[#0f172a] to-transparent pointer-events-none"></div>
    </div>
  )
}

function TerminalIcon() {
  return (
    <svg className="w-4 h-4 text-[#94a3b8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}
