import { useState } from 'react'
import useStore from '../../store/useStore'

export default function DangerZone() {
  const [showConfirm, setShowConfirm] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const logout = useStore((s) => s.logout)

  function handleDelete() {
    // In production this would call a DELETE /auth/account endpoint
    alert('Account deletion is not yet implemented. Contact support.')
    setShowConfirm(false)
    setConfirmText('')
  }

  return (
    <div>
      <div style={{
        border: '1px solid rgba(239,68,68,0.2)',
        borderRadius: 12,
        padding: 24,
        background: 'rgba(239,68,68,0.03)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <span style={{ fontSize: 24 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <h3 style={{
              margin: '0 0 6px', fontSize: 16,
              fontWeight: 700, color: '#fca5a5',
            }}>
              Delete Account
            </h3>
            <p style={{
              margin: '0 0 4px', fontSize: 14, color: '#94a3b8',
            }}>
              Permanently delete your account and all associated data.
            </p>
            <p style={{
              margin: '0 0 16px', fontSize: 13, color: '#ef4444', fontWeight: 500,
            }}>
              This action cannot be undone.
            </p>

            {!showConfirm ? (
              <button
                onClick={() => setShowConfirm(true)}
                style={{
                  padding: '10px 20px', borderRadius: 8,
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  color: '#ef4444', fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
              >
                Delete Account
              </button>
            ) : (
              <div style={{
                background: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.15)',
                borderRadius: 10, padding: 16, marginTop: 8,
              }}>
                <p style={{ color: '#f87171', fontSize: 13, margin: '0 0 10px' }}>
                  Type <strong>DELETE</strong> to confirm:
                </p>
                <input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Type DELETE"
                  style={{
                    width: '100%', padding: '10px 12px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(239,68,68,0.2)',
                    borderRadius: 8, color: '#f1f5f9', fontSize: 14,
                    outline: 'none', boxSizing: 'border-box',
                    marginBottom: 12,
                  }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => { setShowConfirm(false); setConfirmText('') }}
                    style={{
                      padding: '8px 16px', borderRadius: 8,
                      background: 'transparent',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#94a3b8', fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={confirmText !== 'DELETE'}
                    style={{
                      padding: '8px 16px', borderRadius: 8,
                      background: confirmText === 'DELETE' ? '#dc2626' : 'rgba(239,68,68,0.2)',
                      border: 'none',
                      color: '#fff', fontSize: 13, fontWeight: 600,
                      cursor: confirmText === 'DELETE' ? 'pointer' : 'not-allowed',
                      opacity: confirmText === 'DELETE' ? 1 : 0.5,
                    }}
                  >
                    Permanently Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
