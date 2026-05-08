import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

// Dummy Data
const MOCK_LOGS = [
  { id: 1, time: '2026-10-27 14:02:11', pod: 'auth-v2-5x9j', service: 'auth-server', level: 'INFO', message: 'Token validation successful for user_id: 89912. Scope: read_write.' },
  { id: 2, time: '2026-10-27 14:02:15', pod: 'pay-v1-88za', service: 'payment-gw', level: 'ERROR', message: 'ConnectionTimeout: Failed to connect to Stripe API endpoint. Retrying in 500ms...\n  at PaymentGate.Connect (src/gateways/stripe.go:42)' },
  { id: 3, time: '2026-10-27 14:02:19', pod: 'cache-r72k', service: 'redis-master', level: 'WARN', message: 'Memory pressure detected: 82% threshold exceeded. Evicting LRU keys.' },
  { id: 4, time: '2026-10-27 14:02:22', pod: 'proxy-q99l', service: 'envoy-proxy', level: 'INFO', message: 'Inbound GET /health HTTP/1.1 from 10.42.0.1:54212. Status 200.' },
  { id: 5, time: '2026-10-27 14:02:25', pod: 'db-conn-11p', service: 'postgres-db', level: 'ERROR', message: 'PostgresError: FATAL: remaining connection slots are reserved for non-replication superuser connections.' },
  { id: 6, time: '2026-10-27 14:02:28', pod: 'auth-v2-5x9j', service: 'auth-server', level: 'INFO', message: 'Metrics published to Prometheus exporter successfully.' },
  { id: 7, time: '2026-10-27 14:02:30', pod: 'ai-engine-8p2m', service: 'ai-engine', level: 'INFO', message: 'Claude API connection healthy. Waiting for next analysis sequence...' },
  { id: 8, time: '2026-10-27 14:02:35', pod: 'monolith-prod-02', service: 'monolith-worker', level: 'ERROR', message: 'OutOfMemoryError: Java heap space\n  at com.monolith.worker.Processor.execute(Processor.java:152)\n  at java.base/java.lang.Thread.run(Thread.java:829)' },
]

export default function LogExplorer() {
  const [logs, setLogs] = useState(MOCK_LOGS)
  const [selectedLog, setSelectedLog] = useState(MOCK_LOGS[7]) // Select the OOM error by default
  const [isLive, setIsLive] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // Simulate incoming logs
  useEffect(() => {
    if (!isLive) return
    const interval = setInterval(() => {
      const newLog = {
        id: Date.now(),
        time: new Date().toISOString().replace('T', ' ').slice(0, 19),
        pod: 'auth-v2-5x9j',
        service: 'auth-server',
        level: 'INFO',
        message: 'Heartbeat ping ACK - Latency: 12ms'
      }
      setLogs(prev => [newLog, ...prev].slice(0, 100))
    }, 4000)
    return () => clearInterval(interval)
  }, [isLive])

  const filteredLogs = logs.filter(log => 
    log.message.toLowerCase().includes(searchQuery.toLowerCase()) || 
    log.service.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="max-w-[1600px] mx-auto h-[calc(100vh-100px)] flex flex-col pb-4 font-sans">
      
      {/* Top Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight uppercase">LOG_STREAM_LIVE</h1>
          <p className="text-[#94a3b8] text-xs font-mono mt-1">CLUSTER: CLOUDYBRO-PROD-01 <span className="mx-2">•</span> NAMESPACE: CORE-SERVICES</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative">
            <svg className="w-4 h-4 text-[#64748b] absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input 
              type="text" 
              placeholder="Grep logs / trace_id..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#1e293b] border border-[#334155] rounded-md pl-9 pr-4 py-1.5 text-sm text-white focus:outline-none focus:border-[#3b82f6] w-64"
            />
          </div>
          
          {/* Live/Paused Toggle */}
          <div className="flex items-center bg-[#1e293b] rounded-md border border-[#334155] p-0.5">
            <button 
              onClick={() => setIsLive(true)}
              className={`px-3 py-1 rounded text-xs font-bold uppercase transition-colors ${isLive ? 'bg-[#3b82f6] text-white shadow-sm' : 'text-[#94a3b8] hover:text-white'}`}
            >
              Live
            </button>
            <button 
              onClick={() => setIsLive(false)}
              className={`px-3 py-1 rounded text-xs font-bold uppercase transition-colors ${!isLive ? 'bg-[#334155] text-white shadow-sm' : 'text-[#94a3b8] hover:text-white'}`}
            >
              Paused
            </button>
          </div>
          
          <button className="flex items-center gap-2 bg-[#1e293b] border border-[#334155] hover:bg-[#334155] text-white px-3 py-1.5 rounded-md text-xs font-bold transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
            Filter
          </button>
          <button className="flex items-center gap-2 bg-[#1e293b] border border-[#334155] hover:bg-[#334155] text-white px-3 py-1.5 rounded-md text-xs font-bold transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            Export
          </button>
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="flex flex-col xl:flex-row gap-6 flex-1 min-h-0">
        
        {/* Left: Log Viewer */}
        <div className="flex-1 flex flex-col bg-[#0A0F1E] border border-[#1e293b] rounded-lg shadow-xl overflow-hidden font-mono text-sm relative">
          
          {/* Log Table Header */}
          <div className="flex items-center px-4 py-3 border-b border-[#1e293b] bg-[#111827] text-xs font-bold text-[#64748b] tracking-wider uppercase">
            <div className="w-[180px] shrink-0">Timestamp</div>
            <div className="w-[140px] shrink-0">Pod ID</div>
            <div className="w-[140px] shrink-0">Service</div>
            <div className="flex-1">Message</div>
          </div>

          {/* Log Lines */}
          <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
            {filteredLogs.map(log => {
              const isError = log.level === 'ERROR';
              const isWarn = log.level === 'WARN';
              const isSelected = selectedLog?.id === log.id;
              
              return (
                <div 
                  key={log.id} 
                  onClick={() => setSelectedLog(log)}
                  className={`flex items-start px-2 py-1.5 rounded cursor-pointer border-l-2 transition-colors ${
                    isSelected ? 'bg-[#1e293b] border-[#3b82f6]' : 
                    isError ? 'bg-red-900/10 border-red-500 hover:bg-red-900/20' : 
                    isWarn ? 'border-amber-500 hover:bg-white/5' : 
                    'border-transparent hover:bg-white/5'
                  }`}
                >
                  <div className="w-[180px] shrink-0 text-[#64748b] pt-0.5">{log.time}</div>
                  <div className="w-[140px] shrink-0 text-[#3b82f6] pt-0.5">{log.pod}</div>
                  <div className="w-[140px] shrink-0 text-[#94a3b8] pt-0.5">{log.service}</div>
                  <div className="flex-1 text-[#e2e8f0]">
                    <div className="flex items-start gap-2">
                      <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded shrink-0 leading-none mt-0.5 ${
                        isError ? 'bg-red-500/20 text-red-400' :
                        isWarn ? 'bg-amber-500/20 text-amber-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {log.level}
                      </span>
                      <div className="whitespace-pre-wrap font-medium">
                        {log.message}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Log Viewer Footer */}
          <div className="bg-[#111827] border-t border-[#1e293b] px-4 py-2 flex items-center justify-between text-xs text-[#64748b]">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
                <span className={`font-bold tracking-wider ${isLive ? 'text-emerald-500' : 'text-amber-500'}`}>
                  {isLive ? 'STREAMING' : 'PAUSED'}
                </span>
              </div>
              <span>LINES: 4,821</span>
              <span>BUFF: 12MB</span>
            </div>
            <div className="flex items-center gap-6">
              <span>UTF-8</span>
              <span className="text-white">AUTO-SCROLL: <span className="text-[#3b82f6]">ON</span></span>
            </div>
          </div>
        </div>

        {/* Right: AI Copilot Sidebar */}
        <div className="w-full xl:w-[400px] flex flex-col gap-6 shrink-0">
          
          {selectedLog ? (
            <div className="bg-[#1e293b] border border-[#334155] rounded-xl shadow-xl overflow-hidden flex flex-col h-full">
              {/* Header */}
              <div className="px-5 py-4 border-b border-[#334155] flex items-center justify-between bg-[#0f172a]/50">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-[#3b82f6]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  <h2 className="text-sm font-bold text-white tracking-wide">AI COPILOT EXPLAIN</h2>
                </div>
                <span className="px-2 py-0.5 bg-[#3b82f6]/20 text-[#3b82f6] text-[10px] font-bold rounded">CLAUDE 3.5</span>
              </div>
              
              <div className="p-5 flex-1 overflow-y-auto custom-scrollbar">
                
                {/* Analysis Body */}
                <div className="bg-[#0f172a] border border-[#334155] rounded-lg p-4 mb-6">
                  <p className="text-xs text-[#94a3b8] italic mb-3">Analyzing selected error...</p>
                  <p className="text-sm text-[#e2e8f0] leading-relaxed">
                    The <code className="bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded text-xs mx-1">OutOfMemoryError</code> indicates the JVM is exhausted in the <span className="text-blue-400">monolith-worker</span> pod. I noticed a correlation with a <code className="bg-[#334155] text-[#94a3b8] px-1.5 py-0.5 rounded text-xs mx-1">Redis connection spike</code> 2 seconds prior across the cluster.
                  </p>
                </div>

                {/* Root Cause Analysis */}
                <div className="mb-6">
                  <h3 className="text-xs font-bold text-[#64748b] tracking-wider uppercase mb-3">Root Cause Analysis</h3>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 bg-blue-500/20 p-1 rounded-full text-blue-500">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                      </div>
                      <p className="text-sm text-[#cbd5e1] leading-relaxed">
                        The connection pool leaked <strong className="text-white">42 handles</strong> due to unclosed sessions in <code className="text-xs text-[#94a3b8] bg-[#0f172a] px-1 py-0.5 rounded">Processor.java:152</code>.
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 bg-emerald-500/20 p-1 rounded-full text-emerald-500">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                      </div>
                      <p className="text-sm text-[#cbd5e1] leading-relaxed">
                        <strong className="text-white">Recommended action:</strong> Implement a try-with-resources block for Redis sessions and immediately restart the affected pod.
                      </p>
                    </div>
                  </div>
                </div>

                {/* System Impact */}
                <div className="mb-8">
                  <h3 className="text-xs font-bold text-[#64748b] tracking-wider uppercase mb-3">System Impact</h3>
                  <div className="bg-[#0f172a] rounded-lg p-3 border border-[#334155]">
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-xs font-bold text-[#94a3b8]">RISK SCORE</span>
                      <span className="text-lg font-bold text-red-500 leading-none">92%</span>
                    </div>
                    <div className="w-full bg-[#1e293b] rounded-full h-1.5 mb-3">
                      <div className="bg-red-500 h-1.5 rounded-full" style={{ width: '92%' }}></div>
                    </div>
                    <p className="text-xs text-[#94a3b8]">
                      Immediate failure of downstream <strong className="text-white">Inventory Service</strong> expected within 15 minutes if not mitigated.
                    </p>
                  </div>
                </div>

                {/* Quick Actions */}
                <div>
                  <h3 className="text-xs font-bold text-[#64748b] tracking-wider uppercase mb-3">Quick Actions</h3>
                  <div className="space-y-2">
                    <button className="w-full flex items-center justify-center gap-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white py-2.5 rounded-md text-sm font-bold transition-colors shadow-lg shadow-blue-500/20">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                      RESTART POD
                    </button>
                    <button className="w-full flex items-center justify-center gap-2 bg-[#334155] hover:bg-[#475569] text-white py-2.5 rounded-md text-sm font-bold transition-colors border border-[#475569]">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      ROLLBACK DEPLOYMENT
                    </button>
                    <button className="w-full flex items-center justify-center gap-2 bg-[#1e293b] hover:bg-[#334155] text-[#94a3b8] hover:text-white py-2.5 rounded-md text-sm font-bold transition-colors border border-[#334155]">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                      OPEN JIRA TICKET
                    </button>
                  </div>
                </div>
              </div>

              {/* Ask Copilot Input */}
              <div className="p-4 border-t border-[#334155] bg-[#0f172a]/50">
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Ask Copilot about logs..." 
                    className="w-full bg-[#1e293b] border border-[#334155] rounded-md pl-4 pr-10 py-2.5 text-sm text-white focus:outline-none focus:border-[#3b82f6]"
                  />
                  <button className="absolute right-3 top-1/2 -translate-y-1/2 text-[#3b82f6] hover:text-[#60a5fa]">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#1e293b] border border-[#334155] rounded-xl shadow-xl flex flex-col items-center justify-center h-full text-center p-8">
              <div className="w-16 h-16 bg-[#0f172a] rounded-full flex items-center justify-center mb-4 border border-[#334155]">
                <svg className="w-8 h-8 text-[#3b82f6]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">AI Copilot Standby</h3>
              <p className="text-sm text-[#94a3b8]">Select any log entry from the stream to generate an instant root cause analysis and resolution plan.</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 shrink-0">
        <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-5 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-red-500/10 transition-colors"></div>
          <h3 className="text-xs font-bold text-[#64748b] tracking-wider uppercase mb-1 relative z-10">Errors / Min</h3>
          <div className="flex items-baseline gap-3 relative z-10">
            <span className="text-3xl font-bold text-white">14</span>
            <span className="text-xs font-bold text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded">+2.1%</span>
          </div>
        </div>
        
        <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-5 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-emerald-500/10 transition-colors"></div>
          <h3 className="text-xs font-bold text-[#64748b] tracking-wider uppercase mb-1 relative z-10">Active Pods</h3>
          <div className="flex items-baseline gap-3 relative z-10">
            <span className="text-3xl font-bold text-white">128</span>
            <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">Stable</span>
          </div>
        </div>
        
        <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-5 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-amber-500/10 transition-colors"></div>
          <h3 className="text-xs font-bold text-[#64748b] tracking-wider uppercase mb-1 relative z-10">Avg Latency</h3>
          <div className="flex items-baseline gap-2 relative z-10">
            <span className="text-3xl font-bold text-white">242<span className="text-xl text-[#94a3b8]">ms</span></span>
            <span className="text-xs font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">-45ms</span>
          </div>
        </div>
        
        <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-5 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-blue-500/10 transition-colors"></div>
          <h3 className="text-xs font-bold text-[#64748b] tracking-wider uppercase mb-1 relative z-10">Throughput</h3>
          <div className="flex items-baseline gap-2 relative z-10">
            <span className="text-3xl font-bold text-white">1.2k <span className="text-xl text-[#94a3b8]">req/s</span></span>
            <span className="text-xs font-medium text-[#64748b]">Peak</span>
          </div>
        </div>
      </div>

    </div>
  )
}
