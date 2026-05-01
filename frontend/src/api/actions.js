import { actionsClient } from './client'

export const executeAction = (data) =>
  actionsClient.post('/actions/execute', data)

export const approveAction = (actionId) =>
  actionsClient.post(`/actions/${actionId}/approve`)

export const rejectAction = (actionId, reason) =>
  actionsClient.post(`/actions/${actionId}/reject`, { reason })

export const getActions = (params) =>
  actionsClient.get('/actions', { params })

export const getAction = (actionId) =>
  actionsClient.get(`/actions/${actionId}`)

export const getActionsHealth = () =>
  actionsClient.get('/actions/health')
