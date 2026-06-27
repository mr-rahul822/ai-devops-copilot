import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { resetPassword } from '../api/auth'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const navigate = useNavigate()

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!token) {
      setError('Missing reset token. Please use the link from your email or console.')
      return
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      await resetPassword({ token, new_password: newPassword })
      setSuccess(true)
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Something went wrong.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      {/* Background decoration */}
      <div className="fixed inset-0 z-[-1] pointer-events-none bg-[#051424]"></div>

      <div className="w-full max-w-md">
        <div className="glass-panel rounded-24px p-8 sm:p-10 border border-white/10 shadow-2xl">
          {/* Logo */}
          <div className="flex flex-col items-center justify-center mb-8">
            <div className="bg-surface-container border border-white/10 p-4 rounded-2xl shadow-lg mb-6">
              <img src="/logo.png" alt="Cloudy Bro" className="w-16 h-16 object-contain" />
            </div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight text-center">
              {success ? 'Password Reset!' : 'Set New Password'}
            </h2>
            <p className="text-[#94a3b8] text-sm text-center mt-2">
              {success
                ? 'Your password has been successfully reset.'
                : 'Enter your new password below.'}
            </p>
          </div>

          {success ? (
            <div className="animate-[fadeIn_0.3s_ease-out]">
              <div className="bg-green-900/20 border border-green-800 text-green-400 text-sm px-4 py-3 rounded-lg text-center mb-6">
                ✓ Password reset successfully. You can now log in with your new password.
              </div>
              <button
                onClick={() => navigate('/login')}
                className="w-full py-3.5 bg-primary-container text-on-primary-container font-label-caps text-label-caps font-bold rounded-lg transition-all hover:scale-102 hover:shadow-[0_0_20px_rgba(0,212,255,0.3)] duration-200 cursor-pointer"
              >
                Go to Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5 animate-[fadeIn_0.3s_ease-out]">
              {!token && (
                <div className="bg-[#fff7ed]/10 border border-[#ea580c]/30 text-[#ea580c] text-sm px-4 py-3 rounded-lg text-center">
                  ⚠ No reset token found in URL. Please use the reset link from the auth-service console logs.
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-[#e2e8f0] mb-2">New Password</label>
                <input
                  id="reset-new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 bg-surface-container-lowest border border-white/10 rounded-lg text-sm text-white placeholder-outline focus:outline-none focus:border-primary transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-[#e2e8f0] mb-2">Confirm Password</label>
                <input
                  id="reset-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 bg-surface-container-lowest border border-white/10 rounded-lg text-sm text-white placeholder-outline focus:outline-none focus:border-primary transition-all"
                />
              </div>

              {error && (
                <div className="bg-error-container/30 border border-error-container text-error text-sm px-4 py-3 rounded-lg text-center">
                  {error}
                </div>
              )}

              <button
                id="reset-submit-button"
                type="submit"
                disabled={loading || !token}
                className="w-full py-3.5 bg-primary-container text-on-primary-container font-label-caps text-label-caps font-bold rounded-lg transition-all hover:scale-102 hover:shadow-[0_0_20px_rgba(0,212,255,0.3)] duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>

              <button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full text-[13px] text-[#94a3b8] hover:text-white bg-transparent font-medium transition-colors cursor-pointer pt-2"
              >
                ← Back to Login
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
