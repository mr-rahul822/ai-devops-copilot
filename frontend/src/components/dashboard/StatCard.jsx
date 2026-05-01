export default function StatCard({ label, value, sub, icon, borderColor = 'border-[#2563eb]', loading = false }) {
  return (
    <div className={`bg-white/80 dark:bg-gray-800/60 backdrop-blur-md border border-white/20 dark:border-gray-700/50 shadow-sm rounded-2xl border-l-4 ${borderColor} p-5 flex items-start justify-between transition-colors`}>
      <div className="min-w-0">
        <p className="text-[10px] font-bold tracking-[0.1em] text-[#64748b] dark:text-gray-400 uppercase mb-2">{label}</p>
        {loading ? (
          <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        ) : (
          <p className="text-3xl font-bold text-[#0f172a] dark:text-gray-100 tracking-tight font-mono">{value}</p>
        )}
        <p className="text-xs mt-1.5 text-[#64748b] dark:text-gray-400">{sub}</p>
      </div>
      {icon && <div className="shrink-0 ml-3">{icon}</div>}
    </div>
  )
}
