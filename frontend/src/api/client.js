import axios from 'axios'

// Default to empty string (same-origin) for production.
// Nginx reverse proxy handles routing /auth/*, /metrics/*, etc. to backend containers.
// For local dev, create frontend/.env with:
//   VITE_AUTH_URL=http://localhost:3001
//   VITE_METRICS_URL=http://localhost:8001
//   etc.
const AUTH_URL = import.meta.env.VITE_AUTH_URL || ''
const METRICS_URL = import.meta.env.VITE_METRICS_URL || ''
const ALERTS_URL = import.meta.env.VITE_ALERTS_URL || ''
const AI_URL = import.meta.env.VITE_AI_URL || ''
const ACTIONS_URL = import.meta.env.VITE_ACTIONS_URL || ''

function createClient(baseURL) {
  const instance = axios.create({ baseURL, timeout: 30000 })

  instance.interceptors.request.use((config) => {
    const token = localStorage.getItem('copilot_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  })

  instance.interceptors.response.use(
    (res) => res,
    (err) => {
      if (err.response?.status === 401) {
        localStorage.removeItem('copilot_token')
        window.location.href = '/login'
      }
      return Promise.reject(err)
    }
  )

  return instance
}

export const authClient = createClient(AUTH_URL)
export const metricsClient = createClient(METRICS_URL)
export const alertsClient = createClient(ALERTS_URL)
export const aiClient = createClient(AI_URL)
export const actionsClient = createClient(ACTIONS_URL)
