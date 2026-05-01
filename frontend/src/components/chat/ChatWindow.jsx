import { useRef, useEffect } from 'react'
import ChatMessage from './ChatMessage'

export default function ChatWindow({ messages = [], thinking = false }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking])

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {messages.length === 0 && !thinking && (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <div className="w-12 h-12 rounded-xl bg-[#2563eb] flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="text-[#0f172a] font-semibold text-base mb-1">AI DevOps Assistant</h3>
          <p className="text-[#64748b] text-sm max-w-sm">
            Ask me about your infrastructure, diagnose issues, or get recommendations.
          </p>
        </div>
      )}

      {messages.map((msg, i) => (
        <ChatMessage key={i} message={msg} />
      ))}

      {thinking && (
        <div className="flex justify-start mb-4">
          <div className="bg-white border border-[#e2e8f0] px-4 py-3 rounded-xl rounded-bl-sm">
            <div className="flex gap-1 items-center">
              <span className="text-sm text-[#64748b]">Thinking</span>
              <span className="flex gap-1 ml-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#94a3b8] animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[#94a3b8] animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[#94a3b8] animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
