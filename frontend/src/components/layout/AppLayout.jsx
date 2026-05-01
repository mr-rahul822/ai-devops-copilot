import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-950 dark:to-gray-900 text-[#0f172a] dark:text-gray-100 transition-colors">
      <Sidebar />
      <Header />
      <main className="ml-[240px] mt-[60px] p-8 page-fade-in">
        <Outlet />
      </main>
    </div>
  )
}
