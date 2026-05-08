import { useState, useEffect } from 'react'
import { getProfile, updateProfile } from '../../api/auth'

const timezones = Intl.supportedValuesOf
  ? Intl.supportedValuesOf('timeZone')
  : ['UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Asia/Kolkata', 'Asia/Tokyo']

export default function ProfileInfo() {
  const [profile, setProfile] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { loadProfile() }, [])

  async function loadProfile() {
    try {
      const res = await getProfile()
      setProfile(res.data.user)
      setForm(res.data.user)
    } catch (e) {
      setError('Failed to load profile.')
    }
  }

  function onChange(field, val) {
    setForm((f) => ({ ...f, [field]: val }))
    setMsg('')
  }

  async function handleSave() {
    setSaving(true)
    setMsg('')
    setError('')
    try {
      const { full_name, phone, company, job_title, timezone, avatar_url } = form
      const res = await updateProfile({ full_name, phone, company, job_title, timezone, avatar_url })
      setProfile(res.data.user)
      setForm(res.data.user)
      setMsg('Profile saved successfully.')
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to save profile.')
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setForm(profile || {})
    setMsg('')
    setError('')
  }

  if (!profile) {
    return <div style={{ color: '#94a3b8', padding: 32 }}>Loading profile...</div>
  }

  const initials = (form.full_name || form.email || '?').charAt(0).toUpperCase()
  const memberSince = new Date(profile.created_at).toLocaleDateString('en-US', {
    month: 'long', year: 'numeric',
  })

  return (
    <div>
      {/* Avatar + Identity */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 20,
        marginBottom: 32, paddingBottom: 24,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, fontWeight: 700, color: '#fff',
          flexShrink: 0,
        }}>
          {form.avatar_url ? (
            <img src={form.avatar_url} alt="" style={{
              width: 72, height: 72, borderRadius: '50%', objectFit: 'cover',
            }} />
          ) : initials}
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#f1f5f9' }}>
            {form.full_name || form.email}
          </h3>
          <p style={{ margin: '2px 0', fontSize: 14, color: '#94a3b8' }}>{profile.email}</p>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Member since {memberSince}</p>
          {profile.email_verified && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              marginTop: 4, fontSize: 11, color: '#22c55e',
              background: 'rgba(34,197,94,0.1)', padding: '2px 8px', borderRadius: 12,
            }}>
              ✓ Email verified
            </span>
          )}
        </div>
      </div>

      {/* Form fields */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
        <Field label="Full Name" value={form.full_name || ''} onChange={(v) => onChange('full_name', v)} />
        <Field label="Email" value={profile.email} disabled hint="Contact support to change email" />
        <Field label="Phone" value={form.phone || ''} onChange={(v) => onChange('phone', v)} placeholder="+1 234 567 8900" />
        <Field label="Company" value={form.company || ''} onChange={(v) => onChange('company', v)} />
        <Field label="Job Title" value={form.job_title || ''} onChange={(v) => onChange('job_title', v)} />
        <div>
          <label style={labelStyle}>Timezone</label>
          <select
            value={form.timezone || 'UTC'}
            onChange={(e) => onChange('timezone', e.target.value)}
            style={inputStyle}
          >
            {timezones.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Messages */}
      {msg && <div style={{ marginTop: 16, color: '#22c55e', fontSize: 13 }}>✓ {msg}</div>}
      {error && <div style={{ marginTop: 16, color: '#ef4444', fontSize: 13 }}>✗ {error}</div>}

      {/* Buttons */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
        <button onClick={handleCancel} style={btnSecondary}>Cancel</button>
        <button onClick={handleSave} disabled={saving} style={btnPrimary}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, disabled, hint, placeholder }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        style={{ ...inputStyle, ...(disabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        disabled={disabled}
        placeholder={placeholder}
      />
      {hint && <span style={{ fontSize: 11, color: '#64748b' }}>{hint}</span>}
    </div>
  )
}

const labelStyle = {
  display: 'block', fontSize: 13, fontWeight: 500,
  color: '#94a3b8', marginBottom: 6,
}

const inputStyle = {
  width: '100%', padding: '10px 12px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, color: '#f1f5f9', fontSize: 14,
  outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.2s',
}

const btnPrimary = {
  padding: '10px 24px', borderRadius: 8,
  background: '#2563eb', color: '#fff',
  fontSize: 14, fontWeight: 600, border: 'none',
  cursor: 'pointer', transition: 'background 0.2s',
}

const btnSecondary = {
  padding: '10px 24px', borderRadius: 8,
  background: 'transparent', color: '#94a3b8',
  fontSize: 14, fontWeight: 500,
  border: '1px solid rgba(255,255,255,0.1)',
  cursor: 'pointer', transition: 'all 0.2s',
}
