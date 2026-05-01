export default function ServiceHealthGrid({ services }) {
  // services: [{ name: 'auth-service', cpu: 65, mem: 40, status: 'Warning' }, ...]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {services.map((svc, i) => {
        let statusColor = 'text-[#10b981]' // Healthy
        let statusBg = 'bg-[#10b981]/10'
        let borderColor = 'border-[#10b981]/20'
        let dotColor = 'bg-[#10b981]'

        if (svc.status === 'Warning') {
          statusColor = 'text-[#f59e0b]'
          statusBg = 'bg-[#f59e0b]/10'
          borderColor = 'border-[#f59e0b]/20'
          dotColor = 'bg-[#f59e0b]'
        } else if (svc.status === 'Critical') {
          statusColor = 'text-[#ef4444]'
          statusBg = 'bg-[#ef4444]/10'
          borderColor = 'border-[#ef4444]/20'
          dotColor = 'bg-[#ef4444]'
        }

        return (
          <div key={i} className={`p-4 rounded-xl border ${borderColor} bg-white/5 dark:bg-gray-800/30 backdrop-blur-sm transition-colors`}>
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-[13px] text-[#0f172a] dark:text-gray-100 truncate pr-2">
                {svc.name}
              </span>
              <span className={`flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-sm ${statusColor} ${statusBg} uppercase tracking-wider`}>
                <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></span>
                {svc.status}
              </span>
            </div>
            
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-[#64748b] dark:text-gray-400">CPU</span>
                  <span className="text-[#0f172a] dark:text-gray-200 font-mono">{svc.cpu.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-[#e2e8f0] dark:bg-gray-700 rounded-full h-1.5">
                  <div 
                    className={`h-1.5 rounded-full ${svc.cpu > 80 ? 'bg-[#ef4444]' : svc.cpu > 60 ? 'bg-[#f59e0b]' : 'bg-[#3b82f6]'}`} 
                    style={{ width: `${Math.min(svc.cpu, 100)}%` }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-[#64748b] dark:text-gray-400">Memory</span>
                  <span className="text-[#0f172a] dark:text-gray-200 font-mono">{svc.mem.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-[#e2e8f0] dark:bg-gray-700 rounded-full h-1.5">
                  <div 
                    className={`h-1.5 rounded-full ${svc.mem > 80 ? 'bg-[#ef4444]' : svc.mem > 60 ? 'bg-[#f59e0b]' : 'bg-[#8b5cf6]'}`} 
                    style={{ width: `${Math.min(svc.mem, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
