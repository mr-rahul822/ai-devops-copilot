import { useState, useEffect } from 'react'

export default function LiveEventStream() {
  const [events, setEvents] = useState(null) // null = loading
  const [initialized, setInitialized] = useState(false)

  // Simulate initial load
  useEffect(() => {
    const timer = setTimeout(() => {
      setEvents([
        { id: 1, time: '14:23:41.002', type: 'INFO', source: 'auth-service', message: 'User token validated successfully.', color: 'text-gray-400' },
        { id: 2, time: '14:23:42.115', type: 'WARN', source: 'db-proxy', message: 'High connection count detected on primary cluster.', color: 'text-yellow-400' },
        { id: 3, time: '14:23:45.892', type: 'ERROR', source: 'metrics-agent', message: 'Timeout waiting for response from Node 4.', color: 'text-red-400' },
        { id: 4, time: '14:23:48.001', type: 'AI-ACTION', source: 'ai-engine', message: 'Scaling up replica set to mitigate load.', color: 'text-[#2563eb] font-bold' },
        { id: 5, time: '14:23:51.332', type: 'SUCCESS', source: 'k8s-operator', message: 'New pod scheduled on Node 4.', color: 'text-green-400' },
      ])
      setInitialized(true)
    }, 800)
    return () => clearTimeout(timer)
  }, [])

  // Mock incoming events
  useEffect(() => {
    if (!initialized) return
    const interval = setInterval(() => {
      const msgs = [
        { type: 'INFO', source: 'router', message: 'Request routed to us-east-1.', color: 'text-gray-400' },
        { type: 'INFO', source: 'cache', message: 'Cache hit for query xf-992.', color: 'text-gray-400' },
        { type: 'AI-AUDIT', source: 'ai-engine', message: 'Security policy compliance check passed.', color: 'text-[#2563eb]' },
      ]
      const msg = msgs[Math.floor(Math.random() * msgs.length)]
      const now = new Date()
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`
      
      setEvents(prev => {
        const next = [{ id: Date.now(), time: timeStr, ...msg }, ...(prev || [])]
        return next.slice(0, 15)
      })
    }, 4000)
    return () => clearInterval(interval)
  }, [initialized])

  return (
    <div className="bg-[#0f172a] h-[350px] flex flex-col font-mono text-[13px] relative group">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e293b] bg-[#0f172a] z-10 sticky top-0">
        <div className="flex items-center gap-3">
          <TerminalIcon />
          <h3 className="text-[#94a3b8] font-bold tracking-wider uppercase text-[11px]">Live Event Stream</h3>
        </div>
        <div className="flex items-center gap-2">
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
        {events !== null && events.length === 0 && (
          <div className="flex items-center justify-center h-32 text-sm text-gray-400 dark:text-gray-500">
            No events yet — system is monitoring...
          </div>
        )}

        {/* Events list */}
        {events !== null && events.length > 0 && events.map((ev) => (
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
