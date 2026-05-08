export default function PasswordStrength({ password }) {
  const checks = [
    { test: /.{8,}/, label: '8+ characters' },
    { test: /[A-Z]/, label: 'Uppercase letter' },
    { test: /[a-z]/, label: 'Lowercase letter' },
    { test: /\d/, label: 'Number' },
    { test: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/, label: 'Special character' },
  ]

  const passed = checks.filter((c) => c.test.test(password || '')).length
  const percent = (passed / checks.length) * 100
  const label =
    passed === 0 ? '' : passed <= 2 ? 'Weak' : passed <= 3 ? 'Fair' : passed <= 4 ? 'Strong' : 'Very Strong'
  const color =
    passed <= 2 ? '#ef4444' : passed <= 3 ? '#f59e0b' : passed <= 4 ? '#22c55e' : '#10b981'

  if (!password) return null

  return (
    <div style={{ marginTop: 8 }}>
      {/* Strength bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          flex: 1, height: 6, borderRadius: 3,
          background: 'rgba(255,255,255,0.1)',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${percent}%`, height: '100%',
            background: color,
            borderRadius: 3,
            transition: 'width 0.3s, background 0.3s',
          }} />
        </div>
        <span style={{ fontSize: 12, color, fontWeight: 600, minWidth: 80 }}>{label}</span>
      </div>

      {/* Checklist */}
      <div style={{ marginTop: 6, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px' }}>
        {checks.map((c) => {
          const ok = c.test.test(password || '')
          return (
            <span key={c.label} style={{
              fontSize: 11, color: ok ? '#22c55e' : '#64748b',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              {ok ? '✓' : '○'} {c.label}
            </span>
          )
        })}
      </div>
    </div>
  )
}
