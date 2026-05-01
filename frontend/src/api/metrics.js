import { metricsClient } from './client'

/**
 * Fetch the latest metric reading for every monitored service.
 */
export const getLatestMetrics = () =>
  metricsClient.get('/metrics/latest')

/**
 * Fetch historical metric readings for a specific service.
 * Calls GET /metrics/history (the canonical endpoint).
 *
 * @param {Object} params - { user_id, service_name, hours? }
 */
export const getMetricsHistory = (params) =>
  metricsClient.get('/metrics/history', { params }).catch((err) => {
    console.error('[metrics] Failed to fetch history:', err?.response?.status, err?.message)
    throw err
  })

/**
 * Fetch aggregated summary stats for the dashboard stat cards.
 * Calls GET /metrics/summary.
 *
 * Returns: { active_services, avg_cpu, avg_ram, peak_cpu, total_readings, status }
 */
export const getMetricsSummary = () =>
  metricsClient.get('/metrics/summary').catch((err) => {
    console.error('[metrics] Failed to fetch summary:', err?.response?.status, err?.message)
    throw err
  })

/**
 * Fetch distinct service names being monitored.
 *
 * @param {string} userId
 */
export const getServices = (userId) =>
  metricsClient.get('/metrics/services', { params: { user_id: userId } })

/**
 * Manually trigger a single metric collection cycle.
 */
export const triggerCollection = () =>
  metricsClient.post('/metrics/collect')

// ── Cloud Onboarding API ──────────────────────────────────────────────────

/**
 * Connect a cloud provider (AWS).
 * @param {{ provider: string, access_key: string, secret_key: string, region: string }} data
 */
export const connectCloud = (data) =>
  metricsClient.post('/cloud/connect', data).catch((err) => {
    console.error('[cloud] Connect failed:', err?.response?.status, err?.response?.data?.detail)
    throw err
  })

/**
 * Get current cloud connection status.
 */
export const getCloudStatus = () =>
  metricsClient.get('/cloud/status').catch((err) => {
    console.error('[cloud] Status check failed:', err?.response?.status)
    throw err
  })

/**
 * Disconnect a cloud provider.
 * @param {{ provider: string }} data
 */
export const disconnectCloud = (data) =>
  metricsClient.delete('/cloud/disconnect', { data }).catch((err) => {
    console.error('[cloud] Disconnect failed:', err?.response?.status)
    throw err
  })

/**
 * Get live EC2 instance list with metrics.
 */
export const getCloudInstances = () =>
  metricsClient.get('/cloud/instances').catch((err) => {
    console.error('[cloud] Instances fetch failed:', err?.response?.status)
    throw err
  })
