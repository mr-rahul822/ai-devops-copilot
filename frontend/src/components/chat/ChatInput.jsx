import { useState } from 'react'

export default function ChatInput({ onSend, disabled }) {
  const [text, setText] = useState('')

  const handleSend = () => {
    const msg = text.trim()
    if (!msg || disabled) return
    onSend(msg)
    setText('')
  }

  const suggestions = [
    'Why is CPU high?',
    'Show recent alerts',
    "What's the system health?",
  ]

  return (
    <div className="border-t border-[#e2e8f0] dark:border-[#334155] p-4 bg-white dark:bg-[#1e293b]">
      {/* Suggestion chips */}
      <div className="flex gap-2 mb-3">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onSend(s)}
            disabled={disabled}
            className="text-[11px] text-[#2563eb] dark:text-blue-400 bg-[#eff6ff] dark:bg-blue-950/40 px-3 py-1.5 rounded-full hover:bg-[#dbeafe] dark:hover:bg-blue-900/40 disabled:opacity-50 transition-colors"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Input row */}
      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          disabled={disabled}
          placeholder="Ask about your infrastructure..."
          className="flex-1 px-4 py-2.5 border border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#0f172a] rounded-lg text-sm text-[#0f172a] dark:text-white placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent disabled:bg-[#f8fafc] dark:disabled:bg-[#161b22]"
        />
        <button
          onClick={handleSend}
          disabled={disabled || !text.trim()}
          className="px-4 py-2.5 bg-[#2563eb] text-white rounded-lg hover:bg-[#1d4ed8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
          </svg>
        </button>
      </div>
    </div>
  )
}
