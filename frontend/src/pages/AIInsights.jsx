import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { analyzeIncident, chatWithAI } from '../api/ai'
import { getMetricsHistory, getLatestMetrics, getServices } from '../api/metrics'
import { getAlerts } from '../api/alerts'
import ChatWindow from '../components/chat/ChatWindow'
import ChatInput from '../components/chat/ChatInput'
import LoadingSpinner from '../components/common/LoadingSpinner'
import { format } from 'date-fns'

const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001'

const SEVERITY_STYLES = {
  CRITICAL: 'bg-[#fef2f2] text-[#ef4444] border-[#ef4444]/20',
  HIGH:     'bg-[#fff7ed] text-[#ea580c] border-[#ea580c]/20',
  MEDIUM:   'bg-[#fefce8] text-[#ca8a04] border-[#ca8a04]/20',
  LOW:      'bg-[#f0fdf4] text-[#16a34a] border-[#16a34a]/20',
  UNKNOWN:  'bg-[#f8fafc] text-[#64748b] border-[#64748b]/20',
}

const RISK_STYLES = {
  critical: 'bg-[#fef2f2] text-[#ef4444] border-[#ef4444]/20',
  high:     'bg-[#fff7ed] text-[#ea580c] border-[#ea580c]/20',
  medium:   'bg-[#fefce8] text-[#ca8a04] border-[#ca8a04]/20',
  low:      'bg-[#f0fdf4] text-[#16a34a] border-[#16a34a]/20',
}

export default function AIInsights() {
  const navigate = useNavigate()

  // ── State ──────────────────────────────────────────────────────────────
  const [selectedService, setSelectedService] = useState('')
  const [analysis, setAnalysis] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState('')
  const [metricsChartData, setMetricsChartData] = useState([])
  const [rawLogsDisplay, setRawLogsDisplay] = useState('')

  // Chat state
  const [messages, setMessages] = useState([])
  const [thinking, setThinking] = useState(false)

  // ── Fetch services list ────────────────────────────────────────────────
  const { data: servicesData } = useQuery({
    queryKey: ['aiInsightsServices'],
    queryFn: async () => {
      const res = await getServices(DEFAULT_USER_ID)
      const list = res.data?.services || res.data || []
      return Array.isArray(list) ? list : []
    },
    refetchInterval: 60_000,
    onSuccess: (data) => {
      if (data.length > 0 && !selectedService) {
        setSelectedService(typeof data[0] === 'string' ? data[0] : data[0]?.service_name || data[0]?.name || '')
      }
    },
  })

  const services = useMemo(() => {
    if (!servicesData) return []
    return servicesData.map(s => typeof s === 'string' ? s : s?.service_name || s?.name || '')
  }, [servicesData])

  // Auto-select first service on load
  useState(() => {
    if (services.length > 0 && !selectedService) {
      setSelectedService(services[0])
    }
  }, [services])

  // ── Run Analysis ───────────────────────────────────────────────────────
  const handleRunAnalysis = async () => {
    if (!selectedService) return
    setAnalyzing(true)
    setAnalysisError('')
    setAnalysis(null)

    try {
      // 1. Fetch real metrics history (last 1 hour)
      const historyRes = await getMetricsHistory({ service_name: selectedService, hours: 1 })
      const history = historyRes.data?.metrics || historyRes.data?.history || historyRes.data || []
      const historyArr = Array.isArray(history) ? history : []

      // 2. Fetch latest metrics for current values
      const latestRes = await getLatestMetrics()
      const latestList = Array.isArray(latestRes.data) ? latestRes.data : (latestRes.data?.metrics || [])
      const latest = latestList.find(m => (m.service_name || m.service) === selectedService) || {}

      // 3. Fetch recent alerts for this service
      const alertsRes = await getAlerts({ service_name: selectedService })
      const alerts = alertsRes.data?.alerts || alertsRes.data || []
      const alertsArr = Array.isArray(alerts) ? alerts : []

      // Build raw_logs context from real alert data
      const raw_logs = alertsArr.length > 0
        ? alertsArr.map(a =>
            `[${a.created_at || ''}] ${a.severity} [${a.alert_type}] ${a.message || ''} on ${a.service_name} (value: ${a.metric_value}, threshold: ${a.threshold})`
          ).join('\n')
        : `[INFO] No active alerts for ${selectedService}. CPU at ${latest.cpu_percent ?? 'N/A'}%, RAM at ${latest.ram_percent ?? 'N/A'}%, Disk at ${latest.disk_percent ?? 'N/A'}%.`

      setRawLogsDisplay(raw_logs)

      // Build metrics_history for the analyze API
      const metrics_history = historyArr.map(h => ({
        cpu: h.cpu_percent ?? 0,
        ram: h.ram_percent ?? 0,
        timestamp: h.timestamp || null,
      }))

      // Build chart data for display
      const chartData = historyArr.map(h => {
        const ts = h.timestamp ? new Date(h.timestamp) : null
        return {
          time: ts ? format(ts, 'HH:mm') : '',
          cpu: h.cpu_percent ?? 0,
          ram: h.ram_percent ?? 0,
        }
      })
      setMetricsChartData(chartData)

      // 4. Call the multi-agent analysis pipeline
      const result = await analyzeIncident({
        user_id: DEFAULT_USER_ID,
        service_name: selectedService,
        alert_id: alertsArr[0]?.id || null,
        alert_type: alertsArr[0]?.alert_type || 'ROUTINE_CHECK',
        raw_logs,
        current_cpu: latest.cpu_percent ?? 0,
        current_ram: latest.ram_percent ?? 0,
        metrics_history,
      })

      setAnalysis(result.data)
    } catch (err) {
      console.error('[AIInsights] Analysis failed:', err)
      setAnalysisError(err?.response?.data?.detail || 'Analysis failed. Please try again.')
    } finally {
      setAnalyzing(false)
    }
  }

  // ── Chat handler (real /ai/chat) ───────────────────────────────────────
  const handleSend = async (text) => {
    const now = format(new Date(), 'HH:mm')
    const userMsg = { role: 'user', content: text, time: now }
    setMessages(prev => [...prev, userMsg])
    setThinking(true)

    try {
      const res = await chatWithAI({
        message: text,
        user_id: DEFAULT_USER_ID,
        service_name: selectedService || undefined,
        conversation_history: messages.map(m => ({ role: m.role, content: m.content })),
      })
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.data.reply || res.data.response || res.data.message || JSON.stringify(res.data),
        time: format(new Date(), 'HH:mm'),
      }])
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: err?.response?.data?.detail || 'AI Engine is currently unavailable.',
        time: format(new Date(), 'HH:mm'),
      }])
    } finally {
      setThinking(false)
    }
  }

  // ── Derived data from analysis ─────────────────────────────────────────
  const decision = analysis?.decision || null
  const actionPlan = analysis?.action_plan || null
  const isPartial = analysis?.status === 'partial_diagnosis'
  const severity = decision?.severity || 'UNKNOWN'
  const severityStyle = SEVERITY_STYLES[severity] || SEVERITY_STYLES.UNKNOWN
  const riskLevel = actionPlan?.risk_level?.toLowerCase() || ''
  const riskStyle = RISK_STYLES[riskLevel] || RISK_STYLES.low

  return (
    <div className="max-w-[1400px] mx-auto h-[calc(100vh-100px)] flex flex-col">
      {/* ── Top Bar ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-[#0f172a]">AI Insights</h1>
          <p className="text-[13px] text-[#64748b] mt-1">
            AI-powered diagnosis for your connected infrastructure
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            id="service-selector"
            value={selectedService}
            onChange={e => setSelectedService(e.target.value)}
            className="bg-white border border-[#e2e8f0] text-[#0f172a] px-3 py-2 rounded-lg text-[13px] font-medium outline-none focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb] transition-all"
          >
            {services.length === 0 && <option value="">Loading services...</option>}
            {services.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button
            id="run-analysis-btn"
            onClick={handleRunAnalysis}
            disabled={analyzing || !selectedService}
            className="bg-[#2563eb] text-white px-4 py-2 rounded-lg text-[13px] font-medium hover:bg-[#1d4ed8] shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {analyzing ? (
              <>
                <LoadingSpinner size="sm" className="!flex" />
                Analyzing...
              </>
            ) : (
              <>
                <SparklesBlueIcon white />
                Run Analysis
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Main Grid: Left (2/3) + Right Chat (1/3) ──────────────────── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden">

        {/* ── Left Column (scrollable) ──────────────────────────────────── */}
        <div className="lg:col-span-2 overflow-y-auto pr-2 custom-scrollbar space-y-6 pb-6">

          {/* ── Empty State ─────────────────────────────────────────────── */}
          {!analysis && !analyzing && !analysisError && (
            <div className="bg-white rounded-lg border border-[#e2e8f0] shadow-sm p-12 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-[#eff6ff] flex items-center justify-center mb-4">
                <SparklesBlueIcon large />
              </div>
              <h2 className="text-lg font-bold text-[#0f172a] mb-2">No analysis yet</h2>
              <p className="text-[14px] text-[#64748b] max-w-md">
                Select a service and click <strong>Run Analysis</strong> to get an AI-powered diagnosis of your infrastructure.
              </p>
            </div>
          )}

          {/* ── Loading State ──────────────────────────────────────────── */}
          {analyzing && (
            <div className="bg-white rounded-lg border border-[#e2e8f0] shadow-sm p-12 flex flex-col items-center justify-center text-center">
              <LoadingSpinner size="lg" className="mb-4" />
              <h2 className="text-lg font-bold text-[#0f172a] mb-2">Running 4-agent analysis pipeline...</h2>
              <p className="text-[14px] text-[#64748b]">
                Analyzing logs, metrics, past incidents, and generating recommendations. This can take 10-30 seconds.
              </p>
            </div>
          )}

          {/* ── Error State ────────────────────────────────────────────── */}
          {analysisError && !analyzing && (
            <div className="bg-[#fef2f2] rounded-lg border border-[#ef4444]/20 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-[#ef4444]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h2 className="text-[15px] font-bold text-[#ef4444]">Analysis Failed</h2>
              </div>
              <p className="text-[14px] text-[#991b1b]">{analysisError}</p>
              <button onClick={handleRunAnalysis} className="mt-3 text-[13px] text-[#ef4444] underline hover:no-underline">
                Try again
              </button>
            </div>
          )}

          {/* ── Partial Diagnosis Warning ──────────────────────────────── */}
          {isPartial && (
            <div className="bg-[#fefce8] rounded-lg border border-[#ca8a04]/20 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-5 h-5 text-[#ca8a04]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h3 className="text-[14px] font-bold text-[#ca8a04]">Partial Diagnosis</h3>
              </div>
              <p className="text-[13px] text-[#92400e]">
                AI decision engine returned a partial result — log and metrics analysis completed but the recommendation step failed. Try running the analysis again.
              </p>
            </div>
          )}

          {/* ── AI Diagnosis Card ──────────────────────────────────────── */}
          {analysis && decision && (
            <div className="bg-white rounded-lg border border-[#e2e8f0] shadow-sm overflow-hidden">
              <div className="p-5 border-b border-[#e2e8f0] flex items-center justify-between bg-[#f8fafc]">
                <h2 className="text-[15px] font-bold text-[#0f172a] flex items-center gap-2">
                  <SparklesBlueIcon /> AI Diagnosis
                </h2>
                <div className="flex items-center gap-2">
                  <span className={`border px-2 py-0.5 rounded text-[11px] font-bold tracking-wider uppercase ${severityStyle}`}>
                    {severity}
                  </span>
                  {decision.confidence != null && (
                    <span className="bg-[#f0fdf4] text-[#16a34a] border border-[#16a34a]/20 px-2 py-0.5 rounded text-[11px] font-bold tracking-wider">
                      {Math.round(decision.confidence * 100)}% confidence
                    </span>
                  )}
                </div>
              </div>
              <div className="p-5 space-y-4">
                {decision.root_cause && (
                  <div>
                    <h3 className="text-[12px] font-bold text-[#64748b] uppercase tracking-wider mb-1">Root Cause</h3>
                    <p className="text-[14px] text-[#0f172a] leading-relaxed">{decision.root_cause}</p>
                  </div>
                )}
                {decision.simple_explanation && (
                  <div>
                    <h3 className="text-[12px] font-bold text-[#64748b] uppercase tracking-wider mb-1">In Simple Terms</h3>
                    <p className="text-[14px] text-[#475569] leading-relaxed">{decision.simple_explanation}</p>
                  </div>
                )}
                {decision.time_to_fix && (
                  <div className="flex items-center gap-2 text-[13px] text-[#64748b]">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Estimated fix time: <strong className="text-[#0f172a]">{decision.time_to_fix}</strong></span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Context & Evidence Card ─────────────────────────────────── */}
          {analysis && (
            <div className="bg-white rounded-lg border border-[#e2e8f0] shadow-sm">
              <div className="p-5 border-b border-[#e2e8f0]">
                <h2 className="text-[15px] font-bold text-[#0f172a]">Context & Evidence</h2>
              </div>
              <div className="p-5 space-y-5">
                {/* Real CPU/RAM chart */}
                <div>
                  <h3 className="text-[12px] font-bold text-[#64748b] uppercase tracking-wider mb-3">
                    CPU & RAM — Last 1 Hour ({selectedService})
                  </h3>
                  {metricsChartData.length > 0 ? (
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                        <LineChart data={metricsChartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
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
                            tickFormatter={val => `${val}%`}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'rgba(15, 23, 42, 0.95)',
                              borderColor: '#334155',
                              borderRadius: '8px',
                              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                              color: '#f8fafc',
                              fontSize: '12px',
                            }}
                          />
                          <ReferenceLine y={80} stroke="#ef4444" strokeDasharray="3 3" opacity={0.5} label={{ value: '80%', fill: '#ef4444', fontSize: 10 }} />
                          <Line type="monotone" dataKey="cpu" name="CPU %" stroke="#3b82f6" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: '#3b82f6' }} isAnimationActive={false} />
                          <Line type="monotone" dataKey="ram" name="RAM %" stroke="#8b5cf6" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: '#8b5cf6' }} isAnimationActive={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-[120px] bg-[#f8fafc] border border-[#e2e8f0] rounded-lg flex items-center justify-center text-[13px] text-[#64748b]">
                      No metrics history data available
                    </div>
                  )}
                </div>

                {/* Relevant Logs (real alerts) */}
                <div>
                  <h3 className="text-[12px] font-bold text-[#64748b] uppercase tracking-wider mb-3">Relevant Logs</h3>
                  <div className="bg-[#0f172a] rounded-lg p-4 font-mono text-[12px] text-gray-300 space-y-1 max-h-[200px] overflow-y-auto custom-scrollbar">
                    {rawLogsDisplay ? rawLogsDisplay.split('\n').map((line, i) => {
                      const isError = line.includes('CRITICAL') || line.includes('HIGH')
                      const isWarn = line.includes('MEDIUM') || line.includes('WARNING')
                      return (
                        <p key={i}>
                          <span className={isError ? 'text-red-400' : isWarn ? 'text-yellow-400' : 'text-green-400'}>
                            {isError ? 'ERROR' : isWarn ? 'WARN' : 'INFO'}
                          </span>{' '}
                          {line}
                        </p>
                      )
                    }) : (
                      <p className="text-gray-500">No log data to display.</p>
                    )}
                  </div>
                </div>

                {/* Log Analysis output (Agent 1) */}
                {analysis.log_analysis && (
                  <div>
                    <h3 className="text-[12px] font-bold text-[#64748b] uppercase tracking-wider mb-2">Log Analysis Agent Output</h3>
                    <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-lg p-4 text-[13px] text-[#334155]">
                      {typeof analysis.log_analysis === 'string'
                        ? analysis.log_analysis
                        : <pre className="whitespace-pre-wrap text-[12px]">{JSON.stringify(analysis.log_analysis, null, 2)}</pre>
                      }
                    </div>
                  </div>
                )}

                {/* Metrics Analysis output (Agent 2) */}
                {analysis.metrics_analysis && (
                  <div>
                    <h3 className="text-[12px] font-bold text-[#64748b] uppercase tracking-wider mb-2">Metrics Analysis Agent Output</h3>
                    <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-lg p-4 text-[13px] text-[#334155]">
                      {analysis.metrics_analysis.anomaly_score != null && (
                        <p className="mb-1">Anomaly Score: <strong>{analysis.metrics_analysis.anomaly_score}</strong></p>
                      )}
                      {typeof analysis.metrics_analysis === 'string'
                        ? analysis.metrics_analysis
                        : <pre className="whitespace-pre-wrap text-[12px]">{JSON.stringify(analysis.metrics_analysis, null, 2)}</pre>
                      }
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Recommended Fix Card ───────────────────────────────────── */}
          {analysis && decision && decision.fix_steps && (
            <div className="bg-white rounded-lg border border-[#e2e8f0] shadow-sm overflow-hidden">
              <div className="p-5 border-b border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-between">
                <h2 className="text-[15px] font-bold text-[#0f172a] flex items-center gap-2">
                  <LightningIcon className="text-[#2563eb]" /> Recommended Fix
                </h2>
                {riskLevel && (
                  <span className={`border px-2 py-0.5 rounded text-[11px] font-bold tracking-wider uppercase ${riskStyle}`}>
                    {actionPlan?.risk_level} risk
                  </span>
                )}
              </div>
              <div className="p-5 space-y-5">
                {/* Action + target */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-[12px] font-bold text-[#64748b] uppercase tracking-wider mb-1">Recommended Action</h3>
                    <p className="text-[14px] text-[#0f172a] font-mono bg-[#f1f5f9] px-3 py-2 rounded border border-[#e2e8f0]">
                      {decision.recommended_action || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-[12px] font-bold text-[#64748b] uppercase tracking-wider mb-1">Action Target</h3>
                    <p className="text-[14px] text-[#0f172a] font-mono bg-[#f1f5f9] px-3 py-2 rounded border border-[#e2e8f0]">
                      {decision.action_target || selectedService}
                    </p>
                  </div>
                </div>

                {/* Fix steps (numbered list) */}
                <div>
                  <h3 className="text-[12px] font-bold text-[#64748b] uppercase tracking-wider mb-3">Fix Steps</h3>
                  <ol className="space-y-2">
                    {decision.fix_steps.map((step, i) => (
                      <li key={i} className="flex gap-3 items-start">
                        <span className="shrink-0 w-6 h-6 rounded-full bg-[#2563eb] text-white text-[12px] font-bold flex items-center justify-center mt-0.5">
                          {i + 1}
                        </span>
                        <p className="text-[14px] text-[#334155] leading-relaxed">{step}</p>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Reasoning */}
                {decision.reasoning && (
                  <div>
                    <h3 className="text-[12px] font-bold text-[#64748b] uppercase tracking-wider mb-1">Reasoning</h3>
                    <p className="text-[13px] text-[#475569] italic">{decision.reasoning}</p>
                  </div>
                )}

                {/* View in Actions button */}
                {actionPlan && (
                  <button
                    id="view-in-actions-btn"
                    onClick={() => navigate('/actions')}
                    className="bg-[#2563eb] text-white px-5 py-2.5 rounded-lg text-[13px] font-medium hover:bg-[#1d4ed8] shadow-sm flex items-center gap-2 transition-all"
                  >
                    View in Actions
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Right Column: Chat ──────────────────────────────────────── */}
        <div className="bg-white rounded-lg border border-[#e2e8f0] shadow-sm flex flex-col h-full overflow-hidden">
          <div className="p-4 border-b border-[#e2e8f0] bg-[#f8fafc] flex items-center gap-2 shrink-0">
            <img src="/logo.png" className="w-6 h-6 rounded shrink-0 object-contain" alt="Cloudy Bro" />
            <h2 className="text-[15px] font-bold text-[#0f172a]">Cloudy Bro Assistant</h2>
            {selectedService && (
              <span className="ml-auto text-[10px] bg-[#f1f5f9] text-[#64748b] px-2 py-1 rounded">
                {selectedService}
              </span>
            )}
          </div>

          {/* Messages */}
          <ChatWindow messages={messages} thinking={thinking} />

          {/* Input */}
          <ChatInput onSend={handleSend} disabled={thinking} />
        </div>
      </div>
    </div>
  )
}

// ── Icon Components (unchanged) ───────────────────────────────────────────

function LightningIcon({ className = "" }) {
  return (
    <svg className={`w-4 h-4 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
  )
}

function SparklesBlueIcon({ white, large }) {
  return (
    <svg className={`${large ? 'w-8 h-8' : 'w-5 h-5'} ${white ? 'text-white' : 'text-[#2563eb]'}`} fill="currentColor" viewBox="0 0 24 24"><path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
  )
}
