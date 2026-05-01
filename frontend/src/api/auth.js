import { authClient } from './client'

export const loginUser = (email, password) =>
  authClient.post('/auth/login', { email, password })

export const registerUser = (email, password) =>
  authClient.post('/auth/register', { email, password })

export const getMe = () => authClient.get('/auth/me')
