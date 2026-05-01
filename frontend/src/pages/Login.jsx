import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import { loginUser, registerUser } from '../api/auth'

export default function Login() {
  const [tab, setTab] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const setToken = useStore((s) => s.setToken)
  const setUser = useStore((s) => s.setUser)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const fn = tab === 'login' ? loginUser : registerUser
      const res = await fn(email, password)
      const data = res.data
      const token = data.token || data.accessToken
      if (!token) throw new Error('No token received')
      setToken(token)
      setUser(data.user || { email })
      navigate('/dashboard')
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Something went wrong'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-950 dark:to-gray-900 flex items-center justify-center p-4 transition-colors">
      <div className="w-full max-w-[400px] bg-white/80 dark:bg-gray-800/60 backdrop-blur-md border border-white/20 dark:border-gray-700/50 rounded-2xl shadow-sm p-8 transition-colors">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-9 h-9 rounded-lg bg-[#2563eb] flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-[#0f172a] dark:text-gray-100 font-bold text-lg">AI DevOps Copilot</h1>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#e2e8f0] dark:border-gray-700 mb-6">
          <button
            onClick={() => { setTab('login'); setError('') }}
            className={`flex-1 pb-3 text-sm font-semibold border-b-2 transition-colors ${
              tab === 'login' ? 'text-[#2563eb] border-[#2563eb]' : 'text-[#64748b] dark:text-gray-400 border-transparent hover:text-[#0f172a] dark:hover:text-gray-200'
            }`}
          >
            Login
          </button>
          <button
            onClick={() => { setTab('register'); setError('') }}
            className={`flex-1 pb-3 text-sm font-semibold border-b-2 transition-colors ${
              tab === 'register' ? 'text-[#2563eb] border-[#2563eb]' : 'text-[#64748b] dark:text-gray-400 border-transparent hover:text-[#0f172a] dark:hover:text-gray-200'
            }`}
          >
            Register
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#0f172a] dark:text-gray-100 mb-1.5">Email</label>
            <input
              id="email-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@company.com"
              className="w-full px-3 py-2.5 border border-[#e2e8f0] dark:border-gray-600 rounded-lg text-sm text-[#0f172a] dark:text-gray-100 bg-white dark:bg-gray-700 placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#0f172a] dark:text-gray-100 mb-1.5">Password</label>
            <input
              id="password-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full px-3 py-2.5 border border-[#e2e8f0] dark:border-gray-600 rounded-lg text-sm text-[#0f172a] dark:text-gray-100 bg-white dark:bg-gray-700 placeholder-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent"
            />
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm px-3 py-2.5 rounded-lg">
              {error}
            </div>
          )}

          <button
            id="submit-button"
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#2563eb] text-white font-semibold text-sm rounded-lg hover:bg-[#1d4ed8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Please wait...' : tab === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  )
}
