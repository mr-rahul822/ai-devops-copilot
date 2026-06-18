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
          <img src="/logo.png" className="w-12 h-12 rounded shrink-0 object-contain mb-3" alt="Cloudy Bro" />
          <h3 className="text-[#0f172a] dark:text-white font-semibold text-base mb-1">Cloudy Bro Assistant</h3>
          <p className="text-[#64748b] dark:text-gray-400 text-sm max-w-sm">
            Ask me about your infrastructure, diagnose issues, or get recommendations.
          </p>
        </div>
      )}

      {messages.map((msg, i) => (
        <ChatMessage key={i} message={msg} />
      ))}

      {thinking && (
        <div className="flex justify-start mb-4">
          <div className="bg-white dark:bg-[#0f172a] border border-[#e2e8f0] dark:border-[#334155] px-4 py-3 rounded-xl rounded-bl-sm">
            <div className="flex gap-1 items-center">
              <span className="text-sm text-[#64748b] dark:text-gray-400">Thinking</span>
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
