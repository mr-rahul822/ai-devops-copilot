import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { chatWithAI } from '../api/ai'
import { getLatestMetrics } from '../api/metrics'
import { getAlerts } from '../api/alerts'
import ChatWindow from '../components/chat/ChatWindow'
import ChatInput from '../components/chat/ChatInput'
import { format } from 'date-fns'

export default function Chat() {
  const [messages, setMessages] = useState([])
  const [thinking, setThinking] = useState(false)
  // Keep conversation_history in sync with messages for multi-turn context
  const conversationHistory = messages.map(m => ({ role: m.role, content: m.content }))

  // Live context panel data
  const { data: metricsData } = useQuery({
    queryKey: ['chatMetrics'],
    queryFn: async () => {
      const res = await getLatestMetrics()
      return res.data?.metrics || res.data || []
    },
    refetchInterval: 30_000,
  })

  const { data: alertsData } = useQuery({
    queryKey: ['chatAlerts'],
    queryFn: async () => {
      const res = await getAlerts()
      return res.data?.alerts || res.data || []
    },
    refetchInterval: 15_000,
  })

  const metrics = Array.isArray(metricsData) ? metricsData : []
  const alerts = Array.isArray(alertsData) ? alertsData : []
  const avgCpu = metrics.length > 0 ? (metrics.reduce((s, m) => s + (m.cpu_percent || 0), 0) / metrics.length).toFixed(1) : 0
  const avgRam = metrics.length > 0 ? (metrics.reduce((s, m) => s + (m.ram_percent || 0), 0) / metrics.length).toFixed(1) : 0
  const openAlerts = alerts.filter((a) => (a.status || '').toLowerCase() !== 'resolved').length

  const handleSend = async (text) => {
    const now = format(new Date(), 'HH:mm')
    const userMsg = { role: 'user', content: text, time: now }
    setMessages((prev) => [...prev, userMsg])
    setThinking(true)

    try {
      const res = await chatWithAI({
        message: text,
        user_id: '00000000-0000-0000-0000-000000000001',
        conversation_history: conversationHistory,
      })
      const data = res.data
      const aiMsg = {
        role: 'assistant',
        // API returns `reply` field per ChatResponse schema
        content: data.reply || data.response || data.message || data.simple_explanation || JSON.stringify(data),
        fix_steps: data.fix_steps || data.recommended_steps || null,
        severity: data.severity || null,
        time: format(new Date(), 'HH:mm'),
      }
      setMessages((prev) => [...prev, aiMsg])
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: err.response?.data?.detail || 'AI Engine is currently unavailable. Please try again later.',
          time: format(new Date(), 'HH:mm'),
        },
      ])
    } finally {
      setThinking(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#0f172a] dark:text-gray-100 mb-4">Log Explorer</h1>

      <div className="grid grid-cols-[1fr_320px] gap-4 h-[calc(100vh-160px)]">
        {/* Chat window */}
        <div className="bg-white/80 dark:bg-gray-800/60 backdrop-blur-md border border-white/20 dark:border-gray-700/50 rounded-2xl flex flex-col overflow-hidden transition-colors">
          {/* Header */}
          <div className="px-4 py-3 border-b border-[#e2e8f0] dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src="/logo.png" className="w-7 h-7 rounded shrink-0 object-contain" alt="Cloudy Bro" />
              <span className="font-semibold text-sm text-[#0f172a] dark:text-gray-100">Cloudy Bro Assistant</span>
            </div>
            <span className="text-[10px] bg-[#f1f5f9] dark:bg-gray-700 text-[#64748b] dark:text-gray-300 px-2 py-1 rounded">Powered by Gemini</span>
          </div>

          {/* Messages */}
          <ChatWindow messages={messages} thinking={thinking} />

          {/* Input */}
          <ChatInput onSend={handleSend} disabled={thinking} />
        </div>

        {/* Context panel */}
        <div className="bg-white/80 dark:bg-gray-800/60 backdrop-blur-md border border-white/20 dark:border-gray-700/50 rounded-2xl p-5 h-fit transition-colors">
          <h3 className="text-xs font-bold tracking-[0.1em] text-[#0f172a] dark:text-gray-100 uppercase mb-4">Current Context</h3>

          {/* CPU */}
          <div className="mb-4">
            <div className="flex justify-between text-xs text-[#64748b] dark:text-gray-400 mb-1">
              <span>CPU</span>
              <span className="font-semibold text-[#0f172a] dark:text-gray-100">{avgCpu}%</span>
            </div>
            <div className="w-full h-2 bg-[#f1f5f9] dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#2563eb] rounded-full transition-all"
                style={{ width: `${Math.min(avgCpu, 100)}%` }}
              />
            </div>
          </div>

          {/* RAM */}
          <div className="mb-4">
            <div className="flex justify-between text-xs text-[#64748b] dark:text-gray-400 mb-1">
              <span>RAM</span>
              <span className="font-semibold text-[#0f172a] dark:text-gray-100">{avgRam}%</span>
            </div>
            <div className="w-full h-2 bg-[#f1f5f9] dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${avgRam > 80 ? 'bg-[#ef4444]' : 'bg-[#16a34a]'}`}
                style={{ width: `${Math.min(avgRam, 100)}%` }}
              />
            </div>
          </div>

          {/* Stats */}
          <div className="space-y-3 pt-3 border-t border-[#e2e8f0] dark:border-gray-700">
            <div className="flex justify-between text-xs">
              <span className="text-[#64748b] dark:text-gray-400">Open Alerts</span>
              <span className={`font-semibold ${openAlerts > 0 ? 'text-[#ef4444]' : 'text-[#16a34a]'}`}>{openAlerts}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#64748b] dark:text-gray-400">Services Monitored</span>
              <span className="font-semibold text-[#0f172a] dark:text-gray-100">{new Set(metrics.map((m) => m.service_name || m.service).filter(Boolean)).size}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#64748b] dark:text-gray-400">Last Incident</span>
              <span className="font-semibold text-[#0f172a] dark:text-gray-100">{alerts.length > 0 ? 'Recent' : 'None'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
