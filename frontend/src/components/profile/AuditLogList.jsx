import { useState, useEffect } from 'react'
import { getAuditLog } from '../../api/auth'

export default function AuditLogList({ showFull = false }) {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(showFull)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const res = await getAuditLog({ limit: expanded ? 50 : 5 })
      setEvents(res.data.events || [])
    } catch (e) {
      console.error('Failed to load audit log')
    } finally {
      setLoading(false)
    }
  }

  function timeAgo(dateStr) {
    if (!dateStr) return ''
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 7) return `${days}d ago`
    return new Date(dateStr).toLocaleDateString()
  }

  function eventLabel(type) {
    const labels = {
      LOGIN_SUCCESS: 'Login success',
      LOGIN_FAILED: 'Login failed',
      LOGIN_BLOCKED: 'Login blocked',
      LOGOUT: 'Logout',
      PASSWORD_CHANGED: 'Password changed',
      MFA_ENABLED: 'MFA enabled',
      MFA_DISABLED: 'MFA disabled',
      MFA_VERIFIED: 'MFA verified',
      MFA_FAILED: 'MFA failed',
      SESSION_REVOKED: 'Session revoked',
      PROFILE_UPDATED: 'Profile updated',
      PASSWORD_RESET_REQUESTED: 'Password reset requested',
      PASSWORD_RESET_COMPLETED: 'Password reset completed',
      SECURITY_VIOLATION: 'Security violation',
    }
    return labels[type] || type
  }

  async function handleExpand() {
    setExpanded(true)
    setLoading(true)
    try {
      const res = await getAuditLog({ limit: 50 })
      setEvents(res.data.events || [])
    } catch (e) {
      console.error('Failed to load more')
    } finally {
      setLoading(false)
    }
  }

  if (loading && events.length === 0) {
    return <div style={{ color: '#64748b', fontSize: 13 }}>Loading audit log...</div>
  }
  if (events.length === 0) {
    return <div style={{ color: '#64748b', fontSize: 13 }}>No login activity yet.</div>
  }

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {events.map((e, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 12px', borderRadius: 6,
            background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
          }}>
            <span style={{
              fontSize: 14, width: 20, textAlign: 'center',
              color: e.success ? '#22c55e' : '#ef4444',
            }}>
              {e.success ? '✓' : '✗'}
            </span>
            <span style={{
              fontSize: 13, color: '#e2e8f0', flex: 1,
              fontWeight: 500,
            }}>
              {eventLabel(e.event_type)}
            </span>
            <span style={{ fontSize: 12, color: '#64748b', minWidth: 90 }}>
              {e.ip_address}
            </span>
            <span style={{ fontSize: 12, color: '#64748b', minWidth: 80, textAlign: 'right' }}>
              {timeAgo(e.timestamp)}
            </span>
            {e.failure_reason && (
              <span style={{
                fontSize: 11, color: '#f87171',
                background: 'rgba(239,68,68,0.1)',
                padding: '2px 6px', borderRadius: 4,
                maxWidth: 120, overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {e.failure_reason}
              </span>
            )}
          </div>
        ))}
      </div>

      {!expanded && events.length >= 5 && (
        <button
          onClick={handleExpand}
          style={{
            marginTop: 8, padding: '6px 0',
            background: 'transparent', border: 'none',
            color: '#2563eb', fontSize: 13, fontWeight: 500,
            cursor: 'pointer', width: '100%',
          }}
        >
          View Full History →
        </button>
      )}
    </div>
  )
}
