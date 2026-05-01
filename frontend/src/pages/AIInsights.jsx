import { useState } from 'react'

export default function AIInsights() {
  const [chatInput, setChatInput] = useState('')
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'I detected a latency spike in the database cluster. I recommend immediately scaling the read replicas.' },
    { role: 'user', text: 'What caused the spike?' },
    { role: 'ai', text: 'Based on the logs, a sudden influx of complex JOIN queries from the reporting service overwhelmed the connection pool.' },
  ])

  const handleSend = (e) => {
    e.preventDefault()
    if (!chatInput.trim()) return
    setMessages([...messages, { role: 'user', text: chatInput }])
    setChatInput('')
    setTimeout(() => {
      setMessages(m => [...m, { role: 'ai', text: 'I can analyze the specific queries if you provide the request IDs, or I can proceed with scaling the replicas now.' }])
    }, 1000)
  }

  return (
    <div className="max-w-[1200px] mx-auto h-[calc(100vh-100px)] flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[#0f172a]">Incident #4092: Database Latency Spike</h1>
            <span className="bg-[#fef2f2] text-[#ef4444] border border-[#ef4444]/20 px-2 py-0.5 rounded text-[11px] font-bold tracking-wider uppercase">Active</span>
          </div>
          <p className="text-[13px] text-[#64748b] mt-1">Detected 2 minutes ago in eu-central-1</p>
        </div>
        <div className="flex gap-3">
          <button className="bg-white border border-[#e2e8f0] text-[#475569] px-4 py-2 rounded text-[13px] font-medium hover:bg-[#f8fafc] shadow-sm">
            Ignore
          </button>
          <button className="bg-[#2563eb] text-white px-4 py-2 rounded text-[13px] font-medium hover:bg-[#1d4ed8] shadow-sm flex items-center gap-2">
            <LightningIcon /> Execute Fix
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden">
        {/* Left Column (Scrollable) */}
        <div className="lg:col-span-2 overflow-y-auto pr-2 custom-scrollbar space-y-6 pb-6">
          
          {/* AI Diagnosis */}
          <div className="bg-white rounded-lg border border-[#e2e8f0] shadow-sm overflow-hidden">
            <div className="p-5 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8fafc]">
              <h2 className="text-[15px] font-bold text-[#0f172a] flex items-center gap-2">
                <SparklesBlueIcon /> AI Diagnosis
              </h2>
              <span className="bg-[#dcfce7] text-[#16a34a] border border-[#16a34a]/20 px-2 py-0.5 rounded text-[11px] font-bold tracking-wider uppercase">High Confidence (98%)</span>
            </div>
            <div className="p-5">
              <p className="text-[14px] text-[#334155] leading-relaxed">
                The <code className="bg-[#f1f5f9] px-1.5 py-0.5 rounded text-[#ef4444] text-[13px] font-mono border border-[#e2e8f0]">db-prod-eu-central-1</code> cluster is experiencing connection pool exhaustion due to a 400% surge in read queries from the <code className="bg-[#f1f5f9] px-1.5 py-0.5 rounded text-[#2563eb] text-[13px] font-mono border border-[#e2e8f0]">reporting-service</code>. The primary instance CPU is currently at 94%.
              </p>
            </div>
          </div>

          {/* Context & Evidence */}
          <div className="bg-white rounded-lg border border-[#e2e8f0] shadow-sm">
            <div className="p-5 border-b border-[#e2e8f0]">
              <h2 className="text-[15px] font-bold text-[#0f172a]">Context & Evidence</h2>
            </div>
            <div className="p-5 space-y-5">
              {/* Fake Chart */}
              <div>
                <h3 className="text-[12px] font-bold text-[#64748b] uppercase tracking-wider mb-3">Connection Pool Usage</h3>
                <div className="h-[120px] bg-[#f8fafc] border border-[#e2e8f0] rounded-lg flex items-end p-2 gap-1 relative overflow-hidden">
                  <div className="absolute top-4 left-4 right-4 border-t border-dashed border-[#ef4444]/50 z-0"></div>
                  <span className="absolute top-1 left-4 text-[10px] text-[#ef4444] font-bold z-0">Max Capacity (2000)</span>
                  
                  {Array.from({length: 40}).map((_, i) => (
                    <div key={i} className={`flex-1 rounded-t-sm z-10 ${i > 30 ? 'bg-[#ef4444]' : i > 25 ? 'bg-[#f59e0b]' : 'bg-[#3b82f6]'}`} style={{ height: i > 30 ? `${80 + Math.random()*20}%` : i > 25 ? `${50 + Math.random()*30}%` : `${20 + Math.random()*20}%` }}></div>
                  ))}
                </div>
              </div>

              {/* Log Snip */}
              <div>
                <h3 className="text-[12px] font-bold text-[#64748b] uppercase tracking-wider mb-3">Relevant Logs</h3>
                <div className="bg-[#0f172a] rounded-lg p-4 font-mono text-[12px] text-gray-300 space-y-1">
                  <p><span className="text-gray-500">[14:23:42]</span> <span className="text-yellow-400">WARN</span> [db-proxy] Connection pool threshold reached (90%)</p>
                  <p><span className="text-gray-500">[14:23:45]</span> <span className="text-red-400">ERROR</span> [reporting-svc] Timeout acquiring connection from pool</p>
                  <p><span className="text-gray-500">[14:23:46]</span> <span className="text-red-400">ERROR</span> [reporting-svc] Timeout acquiring connection from pool</p>
                </div>
              </div>
            </div>
          </div>

          {/* Recommended Fix */}
          <div className="bg-white rounded-lg border border-[#e2e8f0] shadow-sm overflow-hidden">
            <div className="p-5 border-b border-[#e2e8f0] bg-[#f8fafc]">
              <h2 className="text-[15px] font-bold text-[#0f172a] flex items-center gap-2">
                <LightningIcon className="text-[#2563eb]" /> Recommended Fix
              </h2>
            </div>
            <div className="p-5">
              <p className="text-[13px] text-[#475569] mb-4">Scale up the read replica count from 2 to 4 to distribute the reporting load.</p>
              <div className="bg-[#0f172a] rounded-lg p-4 font-mono text-[13px] text-[#a5b4fc] relative">
                aws rds modify-db-cluster \<br/>
                &nbsp;&nbsp;--db-cluster-identifier db-prod-eu-central-1 \<br/>
                &nbsp;&nbsp;--apply-immediately
                <button className="absolute top-3 right-3 text-gray-400 hover:text-white"><CopyIcon /></button>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Chat */}
        <div className="bg-white rounded-lg border border-[#e2e8f0] shadow-sm flex flex-col h-full overflow-hidden">
          <div className="p-4 border-b border-[#e2e8f0] bg-[#f8fafc] flex items-center gap-2 shrink-0">
            <div className="w-6 h-6 rounded bg-[#2563eb] flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c2.31 0 4.43-.79 6.12-2.11l-2.06-2.5A6.974 6.974 0 0 1 12 19c-3.86 0-7-3.14-7-7s3.14-7 7-7c1.55 0 2.97.51 4.12 1.37l2.17-2.31C16.54 2.8 14.38 2 12 2z"/>
              </svg>
            </div>
            <h2 className="text-[15px] font-bold text-[#0f172a]">Copilot Assistant</h2>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-lg px-4 py-2.5 text-[13px] leading-relaxed ${m.role === 'user' ? 'bg-[#2563eb] text-white rounded-br-none' : 'bg-[#f1f5f9] text-[#0f172a] rounded-bl-none border border-[#e2e8f0]'}`}>
                  {m.text}
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleSend} className="p-4 border-t border-[#e2e8f0] bg-white shrink-0">
            <div className="relative">
              <input 
                type="text" 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask a question..."
                className="w-full pl-4 pr-10 py-2.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-lg text-[13px] outline-none focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb] transition-all"
              />
              <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-[#2563eb] text-white rounded flex items-center justify-center hover:bg-[#1d4ed8]">
                <SendIcon />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

function LightningIcon({ className = "" }) {
  return (
    <svg className={`w-4 h-4 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
  )
}

function SparklesBlueIcon() {
  return (
    <svg className="w-5 h-5 text-[#2563eb]" fill="currentColor" viewBox="0 0 24 24"><path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
  )
}

function CopyIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
  )
}

function SendIcon() {
  return (
    <svg className="w-3.5 h-3.5 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
  )
}
