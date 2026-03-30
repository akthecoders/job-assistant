import { useState, useEffect, useCallback } from 'react'
import { Bell, Plus, Trash2, RefreshCw, ChevronDown, ChevronUp, ExternalLink, Loader2, ToggleLeft, ToggleRight } from 'lucide-react'

interface JobAlert {
  id: number
  query_keywords: string
  location: string | null
  frequency: string
  is_active: number
  last_run_at: string | null
  created_at: string
}

interface AlertResult {
  id: number
  alert_id: number
  job_title: string
  company: string
  job_url: string | null
  snippet: string | null
  match_score: number | null
  is_seen: number
  found_at: string | null
}

const FREQ_CONFIG: Record<string, { label: string; badge: string }> = {
  daily:       { label: 'Daily',       badge: 'bg-blue-500/20 text-blue-300 border border-blue-500/30' },
  twice_daily: { label: 'Twice Daily', badge: 'bg-violet-500/20 text-violet-300 border border-violet-500/30' },
  weekly:      { label: 'Weekly',      badge: 'bg-slate-600/50 text-slate-300 border border-slate-600/60' },
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Never'
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

interface AlertCardProps {
  alert: JobAlert
  onDeleted: () => void
  onToggled: (newState: number) => void
}

function AlertCard({ alert, onDeleted, onToggled }: AlertCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [results, setResults] = useState<AlertResult[]>([])
  const [loadingResults, setLoadingResults] = useState(false)
  const [polling, setPolling] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [resultCount, setResultCount] = useState<number | null>(null)

  // Load result count on mount
  useEffect(() => {
    fetch(`/api/alerts/${alert.id}/results?limit=200`)
      .then(r => r.json())
      .then((data: AlertResult[]) => setResultCount(data.length))
      .catch(() => setResultCount(0))
  }, [alert.id])

  const loadResults = useCallback(async () => {
    setLoadingResults(true)
    try {
      const res = await fetch(`/api/alerts/${alert.id}/results?limit=50`)
      const data: AlertResult[] = await res.json()
      setResults(data)
      setResultCount(data.length)
    } catch {
      // ignore
    } finally {
      setLoadingResults(false)
    }
  }, [alert.id])

  const handleExpand = () => {
    if (!expanded) {
      loadResults()
    }
    setExpanded(v => !v)
  }

  const handlePoll = async () => {
    setPolling(true)
    try {
      await fetch(`/api/alerts/${alert.id}/poll`, { method: 'POST' })
      // Wait a couple seconds then refresh results if expanded
      setTimeout(() => {
        setPolling(false)
        if (expanded) loadResults()
      }, 2500)
    } catch {
      setPolling(false)
    }
  }

  const handleToggle = async () => {
    setToggling(true)
    try {
      const res = await fetch(`/api/alerts/${alert.id}/toggle`, { method: 'PATCH' })
      const data = await res.json()
      onToggled(data.is_active)
    } catch {
      // ignore
    } finally {
      setToggling(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Delete alert for "${alert.query_keywords}"?`)) return
    setDeleting(true)
    try {
      await fetch(`/api/alerts/${alert.id}`, { method: 'DELETE' })
      onDeleted()
    } catch {
      setDeleting(false)
    }
  }

  const freqCfg = FREQ_CONFIG[alert.frequency] ?? FREQ_CONFIG['daily']
  const isActive = alert.is_active === 1

  return (
    <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden">
      {/* Card header */}
      <div className="flex items-start gap-3 p-4">
        {/* Active dot */}
        <div className="flex-shrink-0 mt-1">
          <span
            className={`block w-2.5 h-2.5 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-slate-600'}`}
            title={isActive ? 'Active' : 'Paused'}
          />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-100 truncate">
              {alert.query_keywords}
            </span>
            {alert.location && (
              <span className="text-xs text-slate-400">&mdash; {alert.location}</span>
            )}
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${freqCfg.badge}`}>
              {freqCfg.label}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Last polled: {formatDate(alert.last_run_at)}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Toggle active */}
          <button
            onClick={handleToggle}
            disabled={toggling}
            title={isActive ? 'Pause alert' : 'Resume alert'}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/60 transition-colors disabled:opacity-50"
          >
            {toggling
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : isActive
                ? <ToggleRight className="w-4 h-4 text-emerald-400" />
                : <ToggleLeft className="w-4 h-4" />
            }
          </button>

          {/* Poll Now */}
          <button
            onClick={handlePoll}
            disabled={polling}
            title="Poll now"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-blue-600/20 text-blue-300 border border-blue-600/30 hover:bg-blue-600/30 transition-colors disabled:opacity-50"
          >
            {polling ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Polling...
              </>
            ) : (
              <>
                <RefreshCw className="w-3 h-3" />
                Poll Now
              </>
            )}
          </button>

          {/* Delete */}
          <button
            onClick={handleDelete}
            disabled={deleting}
            title="Delete alert"
            className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
          >
            {deleting
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Trash2 className="w-4 h-4" />
            }
          </button>

          {/* Expand results */}
          <button
            onClick={handleExpand}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-700/60 transition-colors"
          >
            Results {resultCount !== null ? `(${resultCount})` : ''}
            {expanded
              ? <ChevronUp className="w-3.5 h-3.5" />
              : <ChevronDown className="w-3.5 h-3.5" />
            }
          </button>
        </div>
      </div>

      {/* Expanded results */}
      {expanded && (
        <div className="border-t border-slate-700/50 bg-slate-900/30">
          {loadingResults && (
            <div className="flex items-center gap-2 px-5 py-4 text-slate-500 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading results...
            </div>
          )}

          {!loadingResults && results.length === 0 && (
            <p className="px-5 py-4 text-sm text-slate-500">
              No results yet. Click "Poll Now" to search for matching jobs.
            </p>
          )}

          {!loadingResults && results.length > 0 && (
            <ul className="divide-y divide-slate-700/40">
              {results.map(r => (
                <li key={r.id} className="px-5 py-3 hover:bg-slate-800/30 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {r.job_url ? (
                        <a
                          href={r.job_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-blue-300 hover:text-blue-200 flex items-center gap-1 group"
                        >
                          <span className="truncate">{r.job_title || r.job_url}</span>
                          <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </a>
                      ) : (
                        <span className="text-sm font-medium text-slate-300">{r.job_title}</span>
                      )}
                      {r.snippet && (
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{r.snippet}</p>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-600 flex-shrink-0 mt-0.5">
                      {formatDate(r.found_at)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export default function JobAlerts() {
  const [alerts, setAlerts] = useState<JobAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  // Form state
  const [keywords, setKeywords] = useState('')
  const [location, setLocation] = useState('')
  const [frequency, setFrequency] = useState('daily')

  const loadAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts')
      const data: JobAlert[] = await res.json()
      setAlerts(data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAlerts()
  }, [loadAlerts])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!keywords.trim()) {
      setError('Keywords are required.')
      return
    }
    setError('')
    setCreating(true)
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords: keywords.trim(),
          location: location.trim() || null,
          frequency,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.detail || 'Failed to create alert.')
        return
      }
      setKeywords('')
      setLocation('')
      setFrequency('daily')
      await loadAlerts()
    } catch {
      setError('Failed to create alert. Check that the backend is running.')
    } finally {
      setCreating(false)
    }
  }

  const handleDeleted = useCallback((id: number) => {
    setAlerts(prev => prev.filter(a => a.id !== id))
  }, [])

  const handleToggled = useCallback((id: number, newState: number) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_active: newState } : a))
  }, [])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-5 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <Bell className="w-5 h-5 text-blue-400 flex-shrink-0" />
          <div>
            <h1 className="text-xl font-semibold text-slate-100">Job Alerts</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Define keyword alerts and get matched job postings delivered to your dashboard
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        {/* Create alert form */}
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-200 mb-4">Create New Alert</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1">
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Keywords <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={keywords}
                  onChange={e => setKeywords(e.target.value)}
                  placeholder="e.g. Senior React Engineer"
                  className="w-full bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Location
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="e.g. San Francisco or Remote"
                  className="w-full bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Frequency
                </label>
                <select
                  value={frequency}
                  onChange={e => setFrequency(e.target.value)}
                  className="w-full bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="daily">Daily</option>
                  <option value="twice_daily">Twice Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={creating}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Add Alert
                </>
              )}
            </button>
          </form>
        </div>

        {/* Alerts list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200">
              Active Alerts
              {alerts.length > 0 && (
                <span className="ml-2 text-xs font-normal text-slate-500">
                  {alerts.length} total
                </span>
              )}
            </h2>
          </div>

          {loading && (
            <p className="text-slate-500 text-sm animate-pulse">Loading alerts...</p>
          )}

          {!loading && alerts.length === 0 && (
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-8 text-center">
              <Bell className="w-8 h-8 text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-500">
                No alerts yet. Add keywords above to start tracking jobs.
              </p>
            </div>
          )}

          {!loading && alerts.map(alert => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onDeleted={() => handleDeleted(alert.id)}
              onToggled={(newState) => handleToggled(alert.id, newState)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
