import { create } from 'zustand'
import { logoutUser } from '../api/auth'

const useStore = create((set) => ({
  // Auth
  user: null,
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
  logout: async () => {
    try {
      await logoutUser()
    } catch (e) {
      // Server may be unreachable, still clear local state
    }
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
}))

export default useStore
