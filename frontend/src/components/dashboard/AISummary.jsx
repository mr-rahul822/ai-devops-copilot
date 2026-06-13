import { useState } from 'react'
import { chatWithAI } from '../../api/ai'

export default function AISummary({ overallHealth }) {
  const [analyzing, setAnalyzing] = useState(false)
  const [summary, setSummary] = useState("All systems operating within normal parameters. One minor latency spike detected in us-east-1. ML models indicate 98% probability of automatic resolution.")
  const [recommended, setRecommended] = useState("Monitor us-east-1 RDS")
  const [confidence, setConfidence] = useState("98%")

  const handleFullAnalysis = async () => {
    setAnalyzing(true)
    try {
      const res = await chatWithAI({
        message: "Give me a complete health summary of all monitored services right now. Keep it brief and professional. End with 'RECOMMENDED ACTION: [action]' and 'CONFIDENCE: [percent]%'.",
        user_id: '00000000-0000-0000-0000-000000000001',
        conversation_history: [],
      })
      // API returns `reply` per ChatResponse schema
      const text = res.data?.reply || res.data?.response || ""
      
      // Parse out the recommendation and confidence if the AI formatted it properly
      let newSummary = text
      let newRec = recommended
      let newConf = confidence
      
      const recMatch = text.match(/RECOMMENDED ACTION:\s*(.+)/i)
      if (recMatch) newRec = recMatch[1].trim()
      
      const confMatch = text.match(/CONFIDENCE:\s*(\d+)%/i)
      if (confMatch) newConf = confMatch[1].trim() + "%"

      // Remove those lines from the main text
      newSummary = newSummary.replace(/RECOMMENDED ACTION:.*$/im, '').replace(/CONFIDENCE:.*$/im, '').trim()

      setSummary(newSummary)
      setRecommended(newRec)
      setConfidence(newConf)
    } catch (err) {
      console.error(err)
      setSummary("Failed to complete AI analysis. Service unreachable.")
    } finally {
      setAnalyzing(false)
    }
  }

  const statusColor = overallHealth === 'CRITICAL' ? 'text-red-500' : overallHealth === 'WARNING' ? 'text-amber-500' : 'text-green-500'
  const statusBorder = overallHealth === 'CRITICAL' ? 'border-red-500' : overallHealth === 'WARNING' ? 'border-amber-500' : 'border-[#16a34a]'
  const statusDot = overallHealth === 'CRITICAL' ? 'bg-red-500' : overallHealth === 'WARNING' ? 'bg-amber-500' : 'bg-[#16a34a]'
  const statusBg = overallHealth === 'CRITICAL' ? 'bg-red-500/10' : overallHealth === 'WARNING' ? 'bg-amber-500/10' : 'bg-[#16a34a]/10'

  return (
    <div className="bg-[#1e293b] border border-[#334155] rounded-xl shadow-sm flex flex-col h-full">
      <div className="p-5 border-b border-[#334155]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="text-[#3b82f6]">✦</span> AI System Summary
          </h2>
        </div>
        
        <div className="flex items-center justify-between mb-6">
          <span className={`flex items-center gap-1.5 border ${statusBorder} ${statusColor} ${statusBg} text-[11px] font-bold px-2.5 py-1 rounded uppercase tracking-wide`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`}></span> {overallHealth}
          </span>
          <span className="border border-[#334155] text-[#cbd5e1] bg-[#0f172a] text-[11px] font-bold px-2.5 py-1 rounded uppercase tracking-wide">
            Risk: Low
          </span>
        </div>

        <p className="text-[14px] text-[#cbd5e1] leading-relaxed mb-6 italic min-h-[80px]">
          "{summary}"
        </p>

        <button 
          onClick={handleFullAnalysis}
          disabled={analyzing}
          className="w-full py-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded text-[13px] font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
        >
          {analyzing && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
          {analyzing ? 'Analyzing infrastructure...' : 'Run Full Analysis'}
        </button>
      </div>
      
      <div className="bg-[#0f172a] p-5 rounded-b-xl flex items-center justify-between flex-1">
        <div>
          <span className="text-[#3b82f6] font-bold uppercase tracking-wider text-[11px] block mb-1">Recommended Action</span>
          <span className="text-white font-medium text-[13px]">{recommended}</span>
        </div>
        <div className="text-right">
          <span className="text-[#64748b] font-bold uppercase tracking-wider text-[11px] block mb-1">Confidence</span>
          <span className="text-[#3b82f6] font-bold text-[18px] leading-none">{confidence}</span>
        </div>
      </div>
    </div>
  )
}
