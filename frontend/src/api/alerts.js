import { alertsClient } from './client'

export const getAlerts = (params) =>
  alertsClient.get('/alerts', { params })

export const resolveAlert = (alertId) =>
  alertsClient.post(`/alerts/${alertId}/resolve`)
