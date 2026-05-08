import axios from 'axios'

const AUTH_URL = import.meta.env.VITE_AUTH_URL || 'http://localhost:3001'
const METRICS_URL = import.meta.env.VITE_METRICS_URL || 'http://localhost:8001'
const ALERTS_URL = import.meta.env.VITE_ALERTS_URL || 'http://localhost:3003'
const AI_URL = import.meta.env.VITE_AI_URL || 'http://localhost:8002'
const ACTIONS_URL = import.meta.env.VITE_ACTIONS_URL || 'http://localhost:8003'

/**
 * Read the CSRF token from the csrf_token cookie (non-httpOnly).
 */
function getCsrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

function createClient(baseURL, { withCookies = false } = {}) {
  const instance = axios.create({
    baseURL,
    timeout: 30000,
    withCredentials: withCookies, // Send cookies for httpOnly refresh token
  })

  instance.interceptors.request.use((config) => {
    // Attach Bearer token from localStorage
    const token = localStorage.getItem('copilot_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    // Attach CSRF token for state-changing methods
    if (withCookies && ['post', 'patch', 'put', 'delete'].includes(config.method)) {
      const csrf = getCsrfToken()
      if (csrf) {
        config.headers['X-CSRF-Token'] = csrf
      }
    }

    return config
  })

  // Track whether a token refresh is in progress to avoid infinite loops
  let isRefreshing = false
  let refreshSubscribers = []

  function subscribeTokenRefresh(cb) {
    refreshSubscribers.push(cb)
  }

  function onTokenRefreshed(newToken) {
    refreshSubscribers.forEach((cb) => cb(newToken))
    refreshSubscribers = []
  }

  instance.interceptors.response.use(
    (res) => res,
    async (err) => {
      const originalRequest = err.config

      // If 401 and not already retried, try refreshing
      if (err.response?.status === 401 && !originalRequest._retry && withCookies) {
        originalRequest._retry = true

        if (!isRefreshing) {
          isRefreshing = true
          try {
            const refreshRes = await axios.post(
              `${AUTH_URL}/auth/refresh`,
              {},
              { withCredentials: true }
            )
            const newToken = refreshRes.data.accessToken
            if (newToken) {
              localStorage.setItem('copilot_token', newToken)
              onTokenRefreshed(newToken)
              originalRequest.headers.Authorization = `Bearer ${newToken}`
              return instance(originalRequest)
            }
          } catch (refreshErr) {
            // Refresh failed — force logout
            localStorage.removeItem('copilot_token')
            window.location.href = '/login'
            return Promise.reject(refreshErr)
          } finally {
            isRefreshing = false
          }
        } else {
          // Another request is refreshing — wait for it
          return new Promise((resolve) => {
            subscribeTokenRefresh((newToken) => {
              originalRequest.headers.Authorization = `Bearer ${newToken}`
              resolve(instance(originalRequest))
            })
          })
        }
      }

      // Non-401 or non-retryable
      if (err.response?.status === 401) {
        localStorage.removeItem('copilot_token')
        window.location.href = '/login'
      }
      return Promise.reject(err)
    }
  )

  return instance
}

// Auth client uses cookies (httpOnly refresh token + CSRF)
export const authClient = createClient(AUTH_URL, { withCookies: true })

// Other clients — just Bearer token, no cookies needed
export const metricsClient = createClient(METRICS_URL)
export const alertsClient = createClient(ALERTS_URL)
export const aiClient = createClient(AI_URL)
export const actionsClient = createClient(ACTIONS_URL)
