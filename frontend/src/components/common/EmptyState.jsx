export default function EmptyState({ icon, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon && <div className="text-[#94a3b8] mb-3">{icon}</div>}
      <h3 className="text-[#0f172a] font-semibold text-base mb-1">{title}</h3>
      {description && <p className="text-[#64748b] text-sm max-w-sm">{description}</p>}
    </div>
  )
}
