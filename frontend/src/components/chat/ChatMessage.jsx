export default function ChatMessage({ message }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[75%] ${isUser ? 'order-2' : 'order-1'}`}>
        <div
          className={`px-4 py-3 rounded-xl text-sm leading-relaxed ${
            isUser
              ? 'bg-[#2563eb] text-white rounded-br-sm'
              : 'bg-white border border-[#e2e8f0] text-[#0f172a] rounded-bl-sm'
          }`}
        >
          {/* Main text */}
          <p className="whitespace-pre-wrap">{message.content}</p>

          {/* Fix steps */}
          {message.fix_steps && message.fix_steps.length > 0 && (
            <div className="mt-3 pt-3 border-t border-white/20">
              <p className="text-xs font-semibold mb-2 opacity-80">Recommended Steps:</p>
              <ol className="list-decimal pl-4 space-y-1 text-xs">
                {message.fix_steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
          )}

          {/* Severity badge */}
          {message.severity && (
            <span className={`inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded ${
              message.severity === 'critical' ? 'bg-red-100 text-red-700' :
              message.severity === 'high' ? 'bg-orange-100 text-orange-700' :
              'bg-yellow-100 text-yellow-700'
            }`}>
              {message.severity.toUpperCase()}
            </span>
          )}
        </div>

        <p className={`text-[10px] text-[#94a3b8] mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
          {message.time || ''}
        </p>
      </div>
    </div>
  )
}
