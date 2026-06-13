import { useLocation } from 'react-router-dom'

const pageNames = {
  '/clusters': 'Infrastructure',
  '/metrics': 'Metrics',
  '/logs': 'Log Explorer',
  '/multi-cloud': 'Multi-Cloud Manager',
  '/cost': 'Cost Optimization',
}

export default function ComingSoon() {
  const location = useLocation()
  const pageName = pageNames[location.pathname] || 'This Feature'

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-60px)]">
      <div className="text-center max-w-md mx-auto px-6">
        {/* Animated icon */}
        <div className="relative mx-auto w-24 h-24 mb-8">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#2563eb]/20 to-[#7c3aed]/20 animate-pulse" />
          <div className="absolute inset-2 rounded-full bg-gradient-to-br from-[#2563eb]/10 to-[#7c3aed]/10 flex items-center justify-center">
            <svg className="w-10 h-10 text-[#2563eb] dark:text-[#60a5fa]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.1-3.14a1.35 1.35 0 010-2.31l5.1-3.14a1.35 1.35 0 011.16 0l5.1 3.14a1.35 1.35 0 010 2.31l-5.1 3.14a1.35 1.35 0 01-1.16 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.1 3.14a1.35 1.35 0 000 2.31l5.1 3.14a1.35 1.35 0 001.16 0l5.1-3.14a1.35 1.35 0 000-2.31l-5.1-3.14" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 2.25v6.75m0 3.75v6.75" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-[#0f172a] dark:text-white mb-3 tracking-tight">
          {pageName}
        </h1>

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#2563eb]/10 to-[#7c3aed]/10 border border-[#2563eb]/20 dark:border-[#60a5fa]/20 mb-5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2563eb] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#2563eb]" />
          </span>
          <span className="text-[13px] font-semibold text-[#2563eb] dark:text-[#60a5fa]">
            Coming Soon
          </span>
        </div>

        {/* Description */}
        <p className="text-[14px] text-[#64748b] dark:text-gray-400 leading-relaxed">
          We're building something great. This feature is currently under development and will be available in an upcoming release.
        </p>
      </div>
    </div>
  )
}
