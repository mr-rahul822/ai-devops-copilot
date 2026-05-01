import { formatDistanceToNow, format } from 'date-fns'

export function timeAgo(dateStr) {
  if (!dateStr) return ''
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
  } catch {
    return dateStr
  }
}

export function formatTimestamp(dateStr) {
  if (!dateStr) return ''
  try {
    return format(new Date(dateStr), 'HH:mm:ss.SSS')
  } catch {
    return dateStr
  }
}

export function formatDateTime(dateStr) {
  if (!dateStr) return ''
  try {
    return format(new Date(dateStr), 'MMM d, yyyy HH:mm:ss')
  } catch {
    return dateStr
  }
}

export function formatNumber(n) {
  if (n == null) return '0'
  return n.toLocaleString()
}

export function mockDuration() {
  const vals = ['12ms', '28ms', '44ms', '112ms', '442ms', '1.2s', '2.8s', '5ms']
  return vals[Math.floor(Math.random() * vals.length)]
}
