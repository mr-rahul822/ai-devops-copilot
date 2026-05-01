import { useState } from 'react'
import DiagnoseModal from '../common/DiagnoseModal'

const ProgressBar = ({ label, value, type }) => {
  let colorClass = ''
  if (type === 'cpu') {
    colorClass = value > 90 ? 'bg-red-500' : value > 70 ? 'bg-amber-500' : 'bg-green-500'
  } else if (type === 'ram') {
    colorClass = 'bg-[#a855f7]'
  } else if (type === 'disk') {
    colorClass = 'bg-[#06b6d4]'
  }

  const bars = []
  const fillCount = Math.round(value / 10)
  for (let i = 0; i < 10; i++) {
    bars.push(
      <div 
        key={i} 
        className={`flex-1 h-2 rounded-sm ${i < fillCount ? colorClass : 'bg-[#334155]'}`}
      />
    )
  }

  return (
    <div className="flex items-center gap-3 mb-2">
      <div className="w-8 text-[11px] font-bold text-[#94a3b8] uppercase tracking-wider">{label}</div>
      <div className="flex-1 flex gap-[2px]">
        {bars}
      </div>
      <div className="w-8 text-right text-[12px] font-mono text-white">{value.toFixed(0)}%</div>
    </div>
  )
}

export default function ServiceHealthCard({ serviceName, cpu = 0, ram = 0, disk = 0 }) {
  const [modalOpen, setModalOpen] = useState(false)

  const isCritical = cpu > 90 || ram > 90
  const isWarning = !isCritical && (cpu > 70 || ram > 80)
  
  const status = isCritical ? 'CRITICAL' : isWarning ? 'WARNING' : 'HEALTHY'
  const statusColor = isCritical ? 'text-red-500' : isWarning ? 'text-amber-500' : 'text-green-500'
  const statusDot = isCritical ? 'bg-red-500 animate-pulse' : isWarning ? 'bg-amber-500' : 'bg-green-500'

  // Mock uptime based on name
  const uptime = serviceName.includes('metrics') ? '100%' : '99.2%'
  const lastAlert = serviceName.includes('auth') ? '2h ago' : 'None'

  return (
    <>
      <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-4 shadow-sm flex flex-col justify-between">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-[14px] font-bold text-white truncate max-w-[150px]" title={serviceName}>
            {serviceName}
          </h3>
          <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${statusColor}`}>
            {status === 'WARNING' && <span>⚠</span>}
            {status === 'HEALTHY' && <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`}></span>}
            {status === 'CRITICAL' && <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`}></span>}
            {status}
          </div>
        </div>

        <div className="mb-4">
          <ProgressBar label="CPU" value={cpu} type="cpu" />
          <ProgressBar label="RAM" value={ram} type="ram" />
          <ProgressBar label="Disk" value={disk === 0 ? 18.3 : disk} type="disk" />
        </div>

        <div className="grid grid-cols-2 gap-4 text-[11px] text-[#94a3b8] mb-4">
          <div>
            <span className="block mb-0.5">Uptime:</span>
            <span className="text-white font-mono">{uptime}</span>
          </div>
          <div>
            <span className="block mb-0.5">Last alert:</span>
            <span className="text-white">{lastAlert}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-auto">
          <button 
            onClick={() => setModalOpen(true)}
            className="w-full py-1.5 rounded border border-[#3b82f6] text-[#3b82f6] text-[11px] font-bold uppercase tracking-wider hover:bg-[#3b82f6]/10 transition-colors"
          >
            Diagnose
          </button>
          <a 
            href="/actions"
            className="w-full py-1.5 rounded border border-[#334155] text-[#cbd5e1] text-[11px] font-bold uppercase tracking-wider hover:bg-[#334155]/50 transition-colors text-center block"
          >
            View Logs
          </a>
        </div>
      </div>

      <DiagnoseModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        serviceName={serviceName} 
      />
    </>
  )
}
