import { useState, useEffect, useRef } from 'react'
import { setupMFA, verifyMFASetup } from '../../api/auth'

export default function MFASetupModal({ onClose, onEnabled }) {
  const [step, setStep] = useState(1)
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [setupToken, setSetupToken] = useState('')
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [backupCodes, setBackupCodes] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [savedCheck, setSavedCheck] = useState(false)
  const inputRefs = useRef([])

  useEffect(() => {
    startSetup()
  }, [])

  async function startSetup() {
    try {
      const res = await setupMFA()
      setQrCode(res.data.qr_code)
      setSecret(res.data.secret)
      setSetupToken(res.data.setup_token)
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to start MFA setup.')
    }
  }

  function handleCodeChange(index, value) {
    if (!/^\d?$/.test(value)) return
    const next = [...code]
    next[index] = value
    setCode(next)
    setError('')
    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  function handleKeyDown(index, e) {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  function handlePaste(e) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    const next = [...code]
    for (let i = 0; i < 6; i++) next[i] = pasted[i] || ''
    setCode(next)
    const lastIdx = Math.min(pasted.length, 5)
    inputRefs.current[lastIdx]?.focus()
  }

  async function handleVerify() {
    const totp = code.join('')
    if (totp.length !== 6) {
      setError('Enter all 6 digits.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await verifyMFASetup(totp, setupToken)
      setBackupCodes(res.data.backup_codes)
      setStep(3)
    } catch (e) {
      setError(e.response?.data?.error || 'Verification failed.')
    } finally {
      setLoading(false)
    }
  }

  function handleDone() {
    onEnabled?.()
    onClose()
  }

  function downloadCodes() {
    const text = `CloudyBro — MFA Backup Codes\n${'='.repeat(40)}\n\n${backupCodes.join('\n')}\n\nEach code can only be used ONCE.\nGenerated: ${new Date().toISOString()}`
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'mfa-backup-codes.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  function copyCodes() {
    navigator.clipboard.writeText(backupCodes.join('\n'))
  }

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 24, paddingBottom: 16,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>
            Set Up Two-Factor Authentication
          </h2>
          <span style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>
            Step {step} of 3
          </span>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {[1, 2, 3].map((s) => (
            <div key={s} style={{
              flex: 1, height: 4, borderRadius: 2,
              background: s <= step ? '#2563eb' : 'rgba(255,255,255,0.06)',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>

        {/* ── STEP 1: QR Code ─────────────────────────────── */}
        {step === 1 && (
          <div>
            <p style={{ color: '#94a3b8', fontSize: 14, margin: '0 0 8px' }}>
              1. Install an authenticator app:
            </p>
            <p style={{ color: '#cbd5e1', fontSize: 13, margin: '0 0 16px', fontWeight: 500 }}>
              Google Authenticator · Authy · 1Password
            </p>
            <p style={{ color: '#94a3b8', fontSize: 14, margin: '0 0 16px' }}>
              2. Scan this QR code with the app:
            </p>

            <div style={{
              display: 'flex', justifyContent: 'center',
              padding: 16, background: '#fff', borderRadius: 12,
              width: 'fit-content', margin: '0 auto 16px',
            }}>
              {qrCode ? (
                <img src={qrCode} alt="MFA QR Code" style={{ width: 200, height: 200 }} />
              ) : (
                <div style={{ width: 200, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                  Loading...
                </div>
              )}
            </div>

            <p style={{ color: '#64748b', fontSize: 12, margin: '0 0 8px', textAlign: 'center' }}>
              Can't scan? Enter this code manually:
            </p>
            <div style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, padding: '10px 16px',
              textAlign: 'center', fontFamily: 'monospace',
              fontSize: 16, color: '#e2e8f0', letterSpacing: 2,
              wordBreak: 'break-all',
            }}>
              {secret}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
              <button onClick={onClose} style={btnCancel}>Cancel</button>
              <button onClick={() => setStep(2)} style={btnNext}>Next →</button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Verify Code ─────────────────────────── */}
        {step === 2 && (
          <div>
            <p style={{ color: '#94a3b8', fontSize: 14, margin: '0 0 20px' }}>
              Enter the 6-digit code from your authenticator app:
            </p>

            <div style={{
              display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 12,
            }} onPaste={handlePaste}>
              {code.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => (inputRefs.current[i] = el)}
                  value={digit}
                  onChange={(e) => handleCodeChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  maxLength={1}
                  style={{
                    width: 48, height: 56, textAlign: 'center',
                    fontSize: 24, fontWeight: 700, color: '#f1f5f9',
                    background: 'rgba(255,255,255,0.04)',
                    border: `2px solid ${digit ? '#2563eb' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 10, outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                />
              ))}
            </div>

            <p style={{ textAlign: 'center', color: '#64748b', fontSize: 12 }}>
              Code refreshes every 30 seconds
            </p>

            {error && (
              <div style={{
                marginTop: 12, color: '#ef4444', fontSize: 13,
                textAlign: 'center', padding: '8px 12px',
                background: 'rgba(239,68,68,0.1)', borderRadius: 8,
              }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
              <button onClick={() => setStep(1)} style={btnCancel}>← Back</button>
              <button onClick={handleVerify} disabled={loading} style={btnNext}>
                {loading ? 'Verifying...' : 'Verify & Enable →'}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Backup Codes ────────────────────────── */}
        {step === 3 && (
          <div>
            <div style={{
              background: 'rgba(245,158,11,0.1)',
              border: '1px solid rgba(245,158,11,0.3)',
              borderRadius: 8, padding: '12px 16px',
              marginBottom: 16,
            }}>
              <p style={{ color: '#f59e0b', fontSize: 13, fontWeight: 600, margin: '0 0 4px' }}>
                ⚠ IMPORTANT — Save these backup codes
              </p>
              <p style={{ color: '#fbbf24', fontSize: 12, margin: 0 }}>
                If you lose your phone, use these to log in. Each code can only be used ONCE.
              </p>
            </div>

            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10, padding: 20,
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 8, marginBottom: 16,
            }}>
              {backupCodes.map((c) => (
                <span key={c} style={{
                  fontFamily: 'monospace', fontSize: 15,
                  color: '#e2e8f0', textAlign: 'center',
                  padding: '4px 0', fontWeight: 600,
                }}>
                  {c}
                </span>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <button onClick={downloadCodes} style={btnSecondary}>📥 Download Codes</button>
              <button onClick={copyCodes} style={btnSecondary}>📋 Copy All</button>
            </div>

            <label style={{
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 13, color: '#94a3b8', cursor: 'pointer',
              marginBottom: 20,
            }}>
              <input
                type="checkbox"
                checked={savedCheck}
                onChange={(e) => setSavedCheck(e.target.checked)}
                style={{ accentColor: '#2563eb', width: 16, height: 16 }}
              />
              I have saved my backup codes
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={handleDone} disabled={!savedCheck} style={{
                ...btnNext,
                opacity: savedCheck ? 1 : 0.4,
                cursor: savedCheck ? 'pointer' : 'not-allowed',
              }}>
                Done — Enable MFA
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const overlayStyle = {
  position: 'fixed', inset: 0, zIndex: 100,
  background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 16,
}

const modalStyle = {
  background: '#1e293b', borderRadius: 16,
  border: '1px solid rgba(255,255,255,0.08)',
  padding: 32, width: '100%', maxWidth: 520,
  boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
}

const btnCancel = {
  padding: '10px 20px', borderRadius: 8,
  background: 'transparent', color: '#94a3b8',
  fontSize: 14, fontWeight: 500,
  border: '1px solid rgba(255,255,255,0.1)',
  cursor: 'pointer',
}

const btnNext = {
  padding: '10px 24px', borderRadius: 8,
  background: '#2563eb', color: '#fff',
  fontSize: 14, fontWeight: 600, border: 'none',
  cursor: 'pointer',
}

const btnSecondary = {
  flex: 1, padding: '8px 12px', borderRadius: 8,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#cbd5e1', fontSize: 13, fontWeight: 500,
  cursor: 'pointer',
}
