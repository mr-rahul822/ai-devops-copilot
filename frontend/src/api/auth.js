import { authClient } from './client'

// ── Existing ─────────────────────────────────────────────────────────────────
export const loginUser = (email, password) =>
  authClient.post('/auth/login', { email, password })

export const registerUser = (...args) => {
  // Support both legacy (email, password) and new (payload object)
  if (args.length === 2 && typeof args[0] === 'string') {
    return authClient.post('/auth/register', { email: args[0], password: args[1] })
  }
  return authClient.post('/auth/register', args[0])
}

export const getMe = () => authClient.get('/auth/me')

// ── New Auth endpoints ───────────────────────────────────────────────────────
export const logoutUser = () => authClient.post('/auth/logout')

export const refreshToken = () => authClient.post('/auth/refresh')

// ── Profile ──────────────────────────────────────────────────────────────────
export const getProfile = () => authClient.get('/auth/profile')

export const updateProfile = (data) => authClient.patch('/auth/profile', data)

export const changePassword = (data) => authClient.post('/auth/change-password', data)

export const forgotPassword = (email) => authClient.post('/auth/forgot-password', { email })

export const resetPassword = (data) => authClient.post('/auth/reset-password', data)

// ── MFA ──────────────────────────────────────────────────────────────────────
export const setupMFA = () => authClient.post('/auth/mfa/setup')

export const verifyMFASetup = (totp_code, setup_token) =>
  authClient.post('/auth/mfa/verify-setup', { totp_code, setup_token })

export const validateMFA = (data) => authClient.post('/auth/mfa/validate', data)

export const disableMFA = (current_password, totp_code) =>
  authClient.post('/auth/mfa/disable', { current_password, totp_code })

export const regenerateBackupCodes = (current_password) =>
  authClient.post('/auth/mfa/backup-codes', { current_password })

// ── Sessions ─────────────────────────────────────────────────────────────────
export const getSessions = () => authClient.get('/auth/sessions')

export const revokeSession = (sessionId) => authClient.delete(`/auth/sessions/${sessionId}`)

export const revokeAllSessions = () => authClient.delete('/auth/sessions/all')

// ── Audit ────────────────────────────────────────────────────────────────────
export const getAuditLog = (params = {}) =>
  authClient.get('/auth/audit-log', { params })
