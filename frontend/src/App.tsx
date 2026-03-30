import { useEffect, useState } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import { Briefcase, LayoutDashboard, FileText, Settings as SettingsIcon, Wifi, WifiOff, MessageSquare, BarChart2, GitBranch, Linkedin, Bell } from 'lucide-react'
import { getAIHealth } from './api'
import Dashboard from './pages/Dashboard'
import Resumes from './pages/Resumes'
import Settings from './pages/Settings'
import InterviewPrep from './pages/InterviewPrep'
import Analytics from './pages/Analytics'
import ResumeVersions from './pages/ResumeVersions'
import LinkedInOptimizer from './pages/LinkedInOptimizer'
import JobAlerts from './pages/JobAlerts'

type ConnectionStatus = 'checking' | 'connected' | 'disconnected'

export default function App() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('checking')

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const data = await getAIHealth()
        if (data && data.ok === true) {
          setConnectionStatus('connected')
        } else {
          setConnectionStatus('disconnected')
        }
      } catch {
        setConnectionStatus('disconnected')
      }
    }

    checkHealth()
    const interval = setInterval(checkHealth, 15000)
    return () => clearInterval(interval)
  }, [])

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
      isActive
        ? 'bg-blue-600 text-white'
        : 'text-slate-300 hover:bg-slate-700 hover:text-white'
    }`

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 flex flex-col bg-slate-800 text-white">
        {/* Logo / App Name */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-700">
          <div className="flex items-center justify-center w-9 h-9 bg-blue-600 rounded-lg flex-shrink-0">
            <Briefcase className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-base font-semibold leading-tight block">AI Job</span>
            <span className="text-base font-semibold leading-tight block text-blue-400">Assistant</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
          <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Navigation
          </p>
          <NavLink to="/" end className={navLinkClass}>
            <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
            Dashboard
          </NavLink>
          <NavLink to="/resumes" className={navLinkClass}>
            <FileText className="w-4 h-4 flex-shrink-0" />
            Resumes
          </NavLink>
          <NavLink to="/interview" className={navLinkClass}>
            <MessageSquare className="w-4 h-4 flex-shrink-0" />
            Interview Prep
          </NavLink>
          <NavLink to="/analytics" className={navLinkClass}>
            <BarChart2 className="w-4 h-4 flex-shrink-0" />
            Analytics
          </NavLink>
          <NavLink to="/versions" className={navLinkClass}>
            <GitBranch className="w-4 h-4 flex-shrink-0" />
            Versions
          </NavLink>
          <NavLink to="/linkedin" className={navLinkClass}>
            <Linkedin className="w-4 h-4 flex-shrink-0" />
            LinkedIn
          </NavLink>
          <NavLink to="/alerts" className={navLinkClass}>
            <Bell className="w-4 h-4 flex-shrink-0" />
            Alerts
          </NavLink>
          <NavLink to="/settings" className={navLinkClass}>
            <SettingsIcon className="w-4 h-4 flex-shrink-0" />
            Settings
          </NavLink>
        </nav>

        {/* Footer: AI connection status */}
        <div className="px-4 py-4 border-t border-slate-700">
          <div className="flex items-center gap-2.5">
            {connectionStatus === 'checking' && (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 animate-pulse flex-shrink-0" />
                <span className="text-xs text-slate-400">Checking AI backend...</span>
              </>
            )}
            {connectionStatus === 'connected' && (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 flex-shrink-0" />
                <Wifi className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span className="text-xs text-emerald-400 font-medium">AI Connected</span>
              </>
            )}
            {connectionStatus === 'disconnected' && (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-red-400 flex-shrink-0" />
                <WifiOff className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                <span className="text-xs text-red-400 font-medium">AI Disconnected</span>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/resumes" element={<Resumes />} />
          <Route path="/interview" element={<InterviewPrep />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/versions" element={<ResumeVersions />} />
          <Route path="/linkedin" element={<LinkedInOptimizer />} />
          <Route path="/alerts" element={<JobAlerts />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  )
}
