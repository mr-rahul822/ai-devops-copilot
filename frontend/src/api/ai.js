import { aiClient } from './client'

export const analyzeIncident = (data) =>
  aiClient.post('/ai/analyze', data)

export const chatWithAI = (data) =>
  aiClient.post('/ai/chat', data)

export const getIncidents = () =>
  aiClient.get('/ai/incidents')

export const getAIHealth = () =>
  aiClient.get('/ai/health')
