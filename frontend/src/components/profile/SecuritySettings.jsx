import { useState } from 'react'
import { changePassword, getProfile, disableMFA } from '../../api/auth'
import PasswordStrength from './PasswordStrength'
import MFASetupModal from './MFASetupModal'
import SessionsList from './SessionsList'
import AuditLogList from './AuditLogList'

export default function SecuritySettings() {
  // ── Password Change ────────────────────────────────────────────────────────
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' })
  const [pwMsg, setPwMsg] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [showPw, setShowPw] = useState({ current: false, new: false, confirm: false })

  // ── MFA ────────────────────────────────────────────────────────────────────
  const [mfaEnabled, setMfaEnabled] = useState(null)
  const [showMfaModal, setShowMfaModal] = useState(false)
  const [disableForm, setDisableForm] = useState({ password: '', totp: '' })
  const [disableError, setDisableError] = useState('')
  const [showDisable, setShowDisable] = useState(false)

  // Load MFA status
  useState(() => {
    getProfile().then((res) => setMfaEnabled(res.data.user.mfa_enabled)).catch(() => {})
  })

  async function handlePasswordChange(e) {
    e.preventDefault()
    setPwMsg('')
    setPwError('')
    if (pwForm.new_password !== pwForm.confirm_password) {
      setPwError('Passwords do not match.')
      return
    }
    setPwLoading(true)
    try {
      const res = await changePassword(pwForm)
      setPwMsg(res.data.message)
      setPwForm({ current_password: '', new_password: '', confirm_password: '' })
    } catch (err) {
      setPwError(err.response?.data?.error || 'Failed to change password.')
    } finally {
      setPwLoading(false)
    }
  }

  async function handleDisableMFA() {
    setDisableError('')
    try {
      await disableMFA(disableForm.password, disableForm.totp)
      setMfaEnabled(false)
      setShowDisable(false)
      setDisableForm({ password: '', totp: '' })
    } catch (err) {
      setDisableError(err.response?.data?.error || 'Failed to disable MFA.')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* ── Change Password ─────────────────────────────── */}
      <section>
        <h3 style={sectionTitle}>Change Password</h3>
        <form onSubmit={handlePasswordChange} style={{ maxWidth: 420 }}>
          <PasswordField
            label="Current Password"
            value={pwForm.current_password}
            onChange={(v) => setPwForm((f) => ({ ...f, current_password: v }))}
            show={showPw.current}
            onToggle={() => setShowPw((s) => ({ ...s, current: !s.current }))}
          />
          <PasswordField
            label="New Password"
            value={pwForm.new_password}
            onChange={(v) => setPwForm((f) => ({ ...f, new_password: v }))}
            show={showPw.new}
            onToggle={() => setShowPw((s) => ({ ...s, new: !s.new }))}
          />
          <PasswordStrength password={pwForm.new_password} />
          <PasswordField
            label="Confirm Password"
            value={pwForm.confirm_password}
            onChange={(v) => setPwForm((f) => ({ ...f, confirm_password: v }))}
            show={showPw.confirm}
            onToggle={() => setShowPw((s) => ({ ...s, confirm: !s.confirm }))}
          />

          {pwMsg && <div style={{ color: '#22c55e', fontSize: 13, marginTop: 8 }}>✓ {pwMsg}</div>}
          {pwError && <div style={{ color: '#ef4444', fontSize: 13, marginTop: 8 }}>✗ {pwError}</div>}

          <button type="submit" disabled={pwLoading} style={btnPrimary}>
            {pwLoading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </section>

      <hr style={divider} />

      {/* ── Two-Factor Authentication ───────────────────── */}
      <section>
        <h3 style={sectionTitle}>Two-Factor Authentication</h3>
        {mfaEnabled === null ? (
          <p style={{ color: '#64748b', fontSize: 13 }}>Loading...</p>
        ) : mfaEnabled ? (
          <div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
            }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                color: '#22c55e', fontSize: 14, fontWeight: 600,
                background: 'rgba(34,197,94,0.1)',
                padding: '4px 12px', borderRadius: 20,
              }}>
                ✓ ENABLED
              </span>
            </div>
            {!showDisable ? (
              <button onClick={() => setShowDisable(true)} style={btnDanger}>
                Disable MFA
              </button>
            ) : (
              <div style={{
                background: 'rgba(239,68,68,0.05)',
                border: '1px solid rgba(239,68,68,0.15)',
                borderRadius: 10, padding: 16, maxWidth: 380,
              }}>
                <p style={{ color: '#f87171', fontSize: 13, margin: '0 0 12px' }}>
                  Enter your password and a TOTP code to disable MFA:
                </p>
                <input
                  type="password"
                  placeholder="Password"
                  value={disableForm.password}
                  onChange={(e) => setDisableForm((f) => ({ ...f, password: e.target.value }))}
                  style={{ ...inputStyle, marginBottom: 8 }}
                />
                <input
                  type="text"
                  placeholder="6-digit TOTP code"
                  maxLength={6}
                  value={disableForm.totp}
                  onChange={(e) => setDisableForm((f) => ({ ...f, totp: e.target.value }))}
                  style={inputStyle}
                />
                {disableError && (
                  <div style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>{disableError}</div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button onClick={() => setShowDisable(false)} style={btnCancel}>Cancel</button>
                  <button onClick={handleDisableMFA} style={btnDanger}>Confirm Disable</button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>
            <p style={{ color: '#94a3b8', fontSize: 14, margin: '0 0 12px' }}>
              Protect your account with an authenticator app (Google Authenticator, Authy, etc.)
            </p>
            <button onClick={() => setShowMfaModal(true)} style={btnPrimary}>
              Enable MFA →
            </button>
          </div>
        )}
      </section>

      <hr style={divider} />

      {/* ── Active Sessions ─────────────────────────────── */}
      <section>
        <h3 style={sectionTitle}>Active Sessions</h3>
        <SessionsList />
      </section>

      <hr style={divider} />

      {/* ── Recent Login Activity ───────────────────────── */}
      <section>
        <h3 style={sectionTitle}>Recent Login Activity</h3>
        <AuditLogList />
      </section>

      {/* MFA Setup Modal */}
      {showMfaModal && (
        <MFASetupModal
          onClose={() => setShowMfaModal(false)}
          onEnabled={() => setMfaEnabled(true)}
        />
      )}
    </div>
  )
}

function PasswordField({ label, value, onChange, show, onToggle }) {
  return (
    <div style={{ marginBottom: 14, position: 'relative' }}>
      <label style={labelStyle}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
        />
        <button
          type="button"
          onClick={onToggle}
          style={{
            position: 'absolute', right: 10, top: '50%',
            transform: 'translateY(-50%)',
            background: 'transparent', border: 'none',
            color: '#64748b', cursor: 'pointer', fontSize: 16,
            padding: 4,
          }}
        >
          {show ? '🙈' : '👁'}
        </button>
      </div>
    </div>
  )
}

const sectionTitle = {
  fontSize: 16, fontWeight: 700, color: '#f1f5f9',
  margin: '0 0 16px',
  paddingBottom: 8,
  borderBottom: '1px solid rgba(255,255,255,0.06)',
}

const divider = {
  border: 'none',
  borderTop: '1px solid rgba(255,255,255,0.04)',
  margin: 0,
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
}

const btnPrimary = {
  padding: '10px 24px', borderRadius: 8,
  background: '#2563eb', color: '#fff',
  fontSize: 14, fontWeight: 600, border: 'none',
  cursor: 'pointer', marginTop: 12,
}

const btnDanger = {
  padding: '8px 16px', borderRadius: 8,
  background: 'rgba(239,68,68,0.1)',
  border: '1px solid rgba(239,68,68,0.2)',
  color: '#ef4444', fontSize: 13, fontWeight: 600,
  cursor: 'pointer',
}

const btnCancel = {
  padding: '8px 16px', borderRadius: 8,
  background: 'transparent',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#94a3b8', fontSize: 13, fontWeight: 500,
  cursor: 'pointer',
}
