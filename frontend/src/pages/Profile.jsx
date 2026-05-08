import { useState } from 'react'
import ProfileInfo from '../components/profile/ProfileInfo'
import SecuritySettings from '../components/profile/SecuritySettings'
import DangerZone from '../components/profile/DangerZone'

const tabs = [
  { key: 'profile', label: 'Profile', icon: '👤' },
  { key: 'security', label: 'Security', icon: '🔒' },
  { key: 'danger', label: 'Danger Zone', icon: '⚠️' },
]

export default function Profile() {
  const [active, setActive] = useState('profile')

  return (
    <div className="page-fade-in" style={{ padding: '24px 32px', maxWidth: 900, margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{
          margin: 0, fontSize: 26, fontWeight: 800,
          color: '#f1f5f9',
          background: 'linear-gradient(135deg, #f1f5f9, #94a3b8)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          Account Settings
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: '#64748b' }}>
          Manage your profile, security settings, and sessions
        </p>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 4,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        marginBottom: 28,
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '12px 20px',
              background: 'transparent',
              border: 'none',
              borderBottom: `2px solid ${active === tab.key ? '#2563eb' : 'transparent'}`,
              color: active === tab.key ? '#f1f5f9' : '#64748b',
              fontSize: 14,
              fontWeight: active === tab.key ? 600 : 500,
              cursor: 'pointer',
              transition: 'all 0.2s',
              marginBottom: -1,
            }}
          >
            <span style={{ fontSize: 16 }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Card */}
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 14,
        padding: 28,
        backdropFilter: 'blur(10px)',
      }}>
        {active === 'profile' && <ProfileInfo />}
        {active === 'security' && <SecuritySettings />}
        {active === 'danger' && <DangerZone />}
      </div>
    </div>
  )
}
