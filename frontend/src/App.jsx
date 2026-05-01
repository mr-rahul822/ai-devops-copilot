import { Routes, Route, Navigate } from 'react-router-dom'
import useStore from './store/useStore'
import AppLayout from './components/layout/AppLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Alerts from './pages/Alerts'
import Chat from './pages/Chat'
import Actions from './pages/Actions'
import Settings from './pages/Settings'
import CloudConfiguration from './pages/CloudConfiguration'
import AIInsights from './pages/AIInsights'

function ProtectedRoute({ children }) {
  const token = useStore((s) => s.token)
  if (!token) return <Navigate to="/login" replace />
  return children
}

function PublicRoute({ children }) {
  const token = useStore((s) => s.token)
  if (token) return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/clusters" element={<Dashboard />} />
        <Route path="/metrics" element={<Dashboard />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/logs" element={<Dashboard />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/actions" element={<Actions />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/multi-cloud" element={<Dashboard />} />
        <Route path="/cost" element={<Dashboard />} />
        <Route path="/cloud-configuration" element={<CloudConfiguration />} />
        <Route path="/insights" element={<AIInsights />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
