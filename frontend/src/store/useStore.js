import { create } from 'zustand'

// ── Helper: decode JWT and extract user info ────────────────────────────────
function getUserFromToken() {
  try {
    const token = localStorage.getItem('copilot_token')
    if (!token) return null
    const payload = JSON.parse(atob(token.split('.')[1]))
    // Check if token is expired
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      localStorage.removeItem('copilot_token')
      return null
    }
    return {
      id: payload.userId || payload.user_id || payload.sub || null,
      email: payload.email || null,
    }
  } catch (e) {
    return null
  }
}

const useStore = create((set) => ({
  // Auth
  user: getUserFromToken(),
  token: localStorage.getItem('copilot_token') || null,
  setUser: (user) => set({ user }),
  setToken: (token) => {
    if (token) {
      localStorage.setItem('copilot_token', token)
    } else {
      localStorage.removeItem('copilot_token')
    }
    set({ token })
  },
  logout: () => {
    localStorage.removeItem('copilot_token')
    set({ user: null, token: null, openAlertCount: 0, criticalAlertCount: 0 })
  },

  // UI
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  // Cached alert counts for header badge
  openAlertCount: 0,
  criticalAlertCount: 0,
  setAlertCounts: (open, critical) => set({ openAlertCount: open, criticalAlertCount: critical }),

  // AI Insights page state persistence
  insightsService: '',
  insightsAnalysis: null,
  insightsAnalyzing: false,
  insightsError: '',
  insightsChartData: [],
  insightsLogs: '',
  insightsMessages: [],
  setInsightsState: (state) => set((s) => ({ ...s, ...state })),
  resetInsightsState: () => set({
    insightsAnalysis: null,
    insightsAnalyzing: false,
    insightsError: '',
    insightsChartData: [],
    insightsLogs: '',
    insightsMessages: []
  }),
}))

export default useStore
