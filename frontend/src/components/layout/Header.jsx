import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import useStore from '../../store/useStore'

export default function Header() {
  const navigate = useNavigate()
  const user = useStore((s) => s.user)
  const openAlertCount = useStore((s) => s.openAlertCount)
  const initial = user?.email?.[0]?.toUpperCase() || 'U'

  // Dark mode state — read from DOM on mount
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))

  const toggleDark = () => {
    const next = !isDark
    setIsDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  return (
    <header className="fixed top-0 left-[240px] right-0 h-[60px] bg-white dark:bg-gray-900 border-b border-[#e2e8f0] dark:border-gray-700 flex items-center justify-between px-8 z-20 transition-colors">
      {/* Left: Empty space for alignment */}
      <div className="flex items-center gap-6">
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-5">
        <button className="flex items-center gap-2 border border-[#e2e8f0] dark:border-gray-600 rounded px-3 py-1.5 text-[13px] font-medium text-[#475569] dark:text-gray-300 hover:bg-[#f8fafc] dark:hover:bg-gray-800">
          Last 24 Hours
        </button>

        <div className="flex items-center gap-3 border-l border-[#e2e8f0] dark:border-gray-700 pl-5">
          {/* Dark mode toggle */}
          <button
            onClick={toggleDark}
            className="text-[#64748b] dark:text-gray-400 hover:text-[#0f172a] dark:hover:text-gray-200 transition-colors p-1 rounded-md hover:bg-[#f1f5f9] dark:hover:bg-gray-800"
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <SunIcon /> : <MoonIcon />}
          </button>

          <button
            onClick={() => navigate('/alerts')}
            className="relative text-[#64748b] dark:text-gray-400 hover:text-[#0f172a] dark:hover:text-gray-200 transition-colors"
          >
            <BellIcon />
            {openAlertCount > 0 && (
              <span className="absolute -top-1 -right-1 w-[14px] h-[14px] bg-[#ef4444] rounded-full text-white text-[9px] font-bold flex items-center justify-center border-2 border-white dark:border-gray-900">
                {openAlertCount > 9 ? '9+' : openAlertCount}
              </span>
            )}
          </button>
          
          <button className="text-[#64748b] dark:text-gray-400 hover:text-[#0f172a] dark:hover:text-gray-200 transition-colors">
            <HistoryIcon />
          </button>

          <button className="text-[#64748b] dark:text-gray-400 hover:text-[#0f172a] dark:hover:text-gray-200 transition-colors">
            <HelpCircleIcon />
          </button>

          {/* Avatar */}
          <div className="ml-2 w-8 h-8 rounded-full bg-[#1e293b] dark:bg-[#2563eb] text-white flex items-center justify-center text-[13px] font-semibold cursor-default">
            {initial}
          </div>
        </div>
      </div>
    </header>
  )
}

function SunIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  )
}

function BellIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/></svg>
  )
}

function HistoryIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
  )
}

function HelpCircleIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
  )
}
