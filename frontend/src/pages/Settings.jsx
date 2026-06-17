import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProfile, updateProfile, changePassword } from '../api/auth'
import useStore from '../store/useStore'

export default function Settings() {
  const navigate = useNavigate()
  const { user: storeUser } = useStore()

  // Profile state
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' })

  // Password state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState({ type: '', text: '' })

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await getProfile()
        const u = res.data?.user || res.data
        setName(u?.name || '')
        setEmail(u?.email || '')
      } catch {
        setEmail(storeUser?.email || '')
      } finally {
        setProfileLoading(false)
      }
    }
    loadProfile()
  }, [])

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    if (!name.trim()) {
      setProfileMsg({ type: 'error', text: 'Name cannot be empty.' })
      return
    }
    setProfileSaving(true)
    setProfileMsg({ type: '', text: '' })
    try {
      await updateProfile({ name: name.trim() })
      setProfileMsg({ type: 'success', text: '✓ Profile updated successfully.' })
    } catch (err) {
      setProfileMsg({ type: 'error', text: err?.response?.data?.error || 'Failed to update profile.' })
    } finally {
      setProfileSaving(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'All fields are required.' })
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New passwords do not match.' })
      return
    }
    if (newPassword.length < 8) {
      setPasswordMsg({ type: 'error', text: 'New password must be at least 8 characters.' })
      return
    }
    setPasswordSaving(true)
    setPasswordMsg({ type: '', text: '' })
    try {
      await changePassword({ current_password: currentPassword, new_password: newPassword })
      setPasswordMsg({ type: 'success', text: '✓ Password changed successfully.' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setPasswordMsg({ type: 'error', text: err?.response?.data?.error || 'Failed to change password.' })
    } finally {
      setPasswordSaving(false)
    }
  }

  return (
    <div className="max-w-[700px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0f172a] dark:text-gray-100">Settings</h1>
        <p className="text-[13px] text-[#64748b] dark:text-gray-400 mt-1">Manage your account and preferences.</p>
      </div>

      {/* Profile Section */}
      <div className="bg-white/80 dark:bg-gray-800/60 backdrop-blur-md border border-white/20 dark:border-gray-700/50 rounded-2xl p-6 mb-6 transition-colors">
        <h2 className="text-[15px] font-bold text-[#0f172a] dark:text-gray-100 mb-5">Profile</h2>

        {profileLoading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-4 w-24 bg-[#e2e8f0] dark:bg-gray-700 rounded" />
            <div className="h-10 bg-[#e2e8f0] dark:bg-gray-700 rounded-lg" />
          </div>
        ) : (
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-[13px] font-semibold text-[#334155] dark:text-gray-300 mb-1.5">Display Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
                className="w-full px-3 py-2.5 border border-[#e2e8f0] dark:border-gray-600 rounded-lg text-[14px] bg-white dark:bg-gray-700 text-[#0f172a] dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-[#334155] dark:text-gray-300 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                disabled
                className="w-full px-3 py-2.5 border border-[#e2e8f0] dark:border-gray-600 rounded-lg text-[14px] bg-[#f8fafc] dark:bg-gray-800 text-[#64748b] dark:text-gray-400 cursor-not-allowed"
              />
              <p className="text-[11px] text-[#94a3b8] mt-1">Email cannot be changed.</p>
            </div>

            {profileMsg.text && (
              <p className={`text-[13px] font-medium ${profileMsg.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {profileMsg.text}
              </p>
            )}

            <button
              type="submit"
              disabled={profileSaving}
              className="px-5 py-2.5 bg-[#2563eb] text-white text-[13px] font-medium rounded-lg hover:bg-[#1d4ed8] disabled:opacity-50 transition-colors"
            >
              {profileSaving ? 'Saving...' : 'Save Profile'}
            </button>
          </form>
        )}
      </div>

      {/* Change Password Section */}
      <div className="bg-white/80 dark:bg-gray-800/60 backdrop-blur-md border border-white/20 dark:border-gray-700/50 rounded-2xl p-6 mb-6 transition-colors">
        <h2 className="text-[15px] font-bold text-[#0f172a] dark:text-gray-100 mb-5">Change Password</h2>

        <form onSubmit={handleChangePassword} className="space-y-4">
          {[
            { label: 'Current Password', value: currentPassword, onChange: setCurrentPassword, placeholder: '••••••••' },
            { label: 'New Password', value: newPassword, onChange: setNewPassword, placeholder: 'Min. 8 characters' },
            { label: 'Confirm New Password', value: confirmPassword, onChange: setConfirmPassword, placeholder: '••••••••' },
          ].map(({ label, value, onChange, placeholder }) => (
            <div key={label}>
              <label className="block text-[13px] font-semibold text-[#334155] dark:text-gray-300 mb-1.5">{label}</label>
              <input
                type="password"
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full px-3 py-2.5 border border-[#e2e8f0] dark:border-gray-600 rounded-lg text-[14px] bg-white dark:bg-gray-700 text-[#0f172a] dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#2563eb] focus:border-transparent"
              />
            </div>
          ))}

          {passwordMsg.text && (
            <p className={`text-[13px] font-medium ${passwordMsg.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {passwordMsg.text}
            </p>
          )}

          <button
            type="submit"
            disabled={passwordSaving}
            className="px-5 py-2.5 bg-[#0f172a] dark:bg-gray-700 text-white text-[13px] font-medium rounded-lg hover:bg-[#1e293b] disabled:opacity-50 transition-colors"
          >
            {passwordSaving ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>

      {/* Cloud Configuration Link */}
      <div className="bg-white/80 dark:bg-gray-800/60 backdrop-blur-md border border-white/20 dark:border-gray-700/50 rounded-2xl p-6 mb-6 transition-colors">
        <h2 className="text-[15px] font-bold text-[#0f172a] dark:text-gray-100 mb-2">Cloud Configuration</h2>
        <p className="text-[13px] text-[#64748b] dark:text-gray-400 mb-4">Connect and manage your AWS, Azure, or GCP accounts.</p>
        <button
          onClick={() => navigate('/cloud-configuration')}
          className="px-5 py-2.5 bg-[#ff9900] text-white text-[13px] font-medium rounded-lg hover:bg-[#e68a00] transition-colors"
        >
          Manage Cloud Connections →
        </button>
      </div>

      {/* Coming Soon Section */}
      <div className="bg-white/80 dark:bg-gray-800/60 backdrop-blur-md border border-white/20 dark:border-gray-700/50 rounded-2xl p-6 transition-colors opacity-60">
        <h2 className="text-[15px] font-bold text-[#0f172a] dark:text-gray-100 mb-2">Security (Coming Soon)</h2>
        <div className="space-y-2 text-[13px] text-[#64748b] dark:text-gray-400">
          <p>🔐 Two-Factor Authentication (TOTP)</p>
          <p>📱 Active Sessions Management</p>
          <p>🔔 Security Alert Notifications</p>
          <p>🗑️ Account Deletion</p>
        </div>
      </div>
    </div>
  )
}
