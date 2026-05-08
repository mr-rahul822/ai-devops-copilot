import { useState, useEffect } from 'react'
import { getSessions, revokeSession, revokeAllSessions } from '../../api/auth'

export default function SessionsList() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [revoking, setRevoking] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const res = await getSessions()
      setSessions(res.data.sessions || [])
    } catch (e) {
      console.error('Failed to load sessions')
    } finally {
      setLoading(false)
    }
  }

  async function handleRevoke(id) {
    setRevoking(id)
    try {
      await revokeSession(id)
      setSessions((s) => s.filter((x) => x.id !== id))
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to revoke session')
    } finally {
      setRevoking(null)
    }
  }

  async function handleRevokeAll() {
    if (!confirm('Revoke all other sessions? You will remain logged in on this device only.')) return
    try {
      await revokeAllSessions()
      setSessions((s) => s.filter((x) => x.is_current))
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to revoke sessions')
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
    return `${days}d ago`
  }

  if (loading) return <div style={{ color: '#64748b', fontSize: 13 }}>Loading sessions...</div>
  if (sessions.length === 0) return <div style={{ color: '#64748b', fontSize: 13 }}>No active sessions.</div>

  return (
    <div>
      <div style={{
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 10, overflow: 'hidden',
      }}>
        {sessions.map((s, i) => (
          <div key={s.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px',
            borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none',
            background: s.is_current ? 'rgba(37,99,235,0.06)' : 'transparent',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 20 }}>
                {s.os?.toLowerCase().includes('ios') || s.os?.toLowerCase().includes('android') ? '📱' : '🖥'}
              </span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>
                  {s.browser || 'Unknown'} on {s.os || 'Unknown'}
                  {s.is_current && (
                    <span style={{
                      marginLeft: 8, fontSize: 11, color: '#22c55e',
                      background: 'rgba(34,197,94,0.1)',
                      padding: '2px 8px', borderRadius: 10,
                    }}>
                      CURRENT
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  {s.ip_address} · {timeAgo(s.last_active_at)}
                </div>
              </div>
            </div>
            {!s.is_current && (
              <button
                onClick={() => handleRevoke(s.id)}
                disabled={revoking === s.id}
                style={{
                  padding: '6px 14px', borderRadius: 6,
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  color: '#ef4444', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {revoking === s.id ? '...' : 'Revoke'}
              </button>
            )}
          </div>
        ))}
      </div>

      {sessions.length > 1 && (
        <button
          onClick={handleRevokeAll}
          style={{
            marginTop: 12, padding: '8px 16px', borderRadius: 8,
            background: 'rgba(239,68,68,0.06)',
            border: '1px solid rgba(239,68,68,0.15)',
            color: '#f87171', fontSize: 13, fontWeight: 500,
            cursor: 'pointer', width: '100%',
          }}
        >
          Revoke All Other Sessions
        </button>
      )}
    </div>
  )
}
