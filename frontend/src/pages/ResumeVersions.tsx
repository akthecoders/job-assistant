import { useState, useEffect } from 'react'
import { listApplications } from '../api'
import type { Application } from '../types'

interface Version {
  id: number
  application_id: number
  version_label: string
  ats_score?: number
  created_at: string
}

interface DiffLine {
  type: 'equal' | 'add' | 'remove'
  content: string
}

interface DiffResult {
  v1: { id: number; label: string; ats_score?: number }
  v2: { id: number; label: string; ats_score?: number }
  diff: DiffLine[]
  stats: { added: number; removed: number; unchanged: number }
}

export default function ResumeVersions() {
  const [apps, setApps] = useState<Application[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [versions, setVersions] = useState<Version[]>([])
  const [snapshotting, setSnapshotting] = useState(false)
  const [compareMode, setCompareMode] = useState(false)
  const [v1Id, setV1Id] = useState<number | null>(null)
  const [v2Id, setV2Id] = useState<number | null>(null)
  const [diff, setDiff] = useState<DiffResult | null>(null)
  const [loadingDiff, setLoadingDiff] = useState(false)

  useEffect(() => {
    listApplications().then(setApps).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedId) return
    fetch(`/api/versions/${selectedId}`)
      .then(r => r.json()).then(setVersions).catch(() => {})
  }, [selectedId])

  const takeSnapshot = async (label?: string) => {
    if (!selectedId) return
    setSnapshotting(true)
    try {
      const r = await fetch(`/api/versions/${selectedId}/snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: label || null }),
      })
      if (r.ok) {
        const v = await r.json()
        setVersions(prev => [{ ...v, application_id: selectedId, created_at: new Date().toISOString() }, ...prev])
      }
    } finally { setSnapshotting(false) }
  }

  const loadDiff = async () => {
    if (!selectedId || !v1Id || !v2Id || v1Id === v2Id) return
    setLoadingDiff(true)
    try {
      const r = await fetch(`/api/versions/${selectedId}/diff/${v1Id}/${v2Id}`)
      if (r.ok) setDiff(await r.json())
    } finally { setLoadingDiff(false) }
  }

  const deleteVersion = async (id: number) => {
    await fetch(`/api/versions/${id}`, { method: 'DELETE' })
    setVersions(prev => prev.filter(v => v.id !== id))
    if (v1Id === id) setV1Id(null)
    if (v2Id === id) setV2Id(null)
    setDiff(null)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 px-6 py-5 border-b border-slate-200">
        <h1 className="text-xl font-semibold text-slate-800">Resume Versions</h1>
        <p className="text-sm text-slate-500 mt-0.5">Snapshot tailored resumes and compare changes side by side</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* App picker + controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={selectedId ?? ''}
            onChange={e => { setSelectedId(Number(e.target.value) || null); setVersions([]); setDiff(null) }}
            className="flex-1 bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select an application...</option>
            {apps.map(a => (
              <option key={a.id} value={a.id}>{a.job_title} — {a.company}</option>
            ))}
          </select>

          {selectedId && (
            <button onClick={() => takeSnapshot()} disabled={snapshotting}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl text-sm font-medium text-white transition-colors shrink-0">
              {snapshotting ? 'Saving...' : '+ Snapshot'}
            </button>
          )}
        </div>

        {selectedId && versions.length > 0 && (
          <>
            {/* Version timeline */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-600">{versions.length} version{versions.length !== 1 ? 's' : ''}</p>
                {versions.length >= 2 && (
                  <button onClick={() => { setCompareMode(m => !m); setDiff(null) }}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors font-medium ${compareMode ? 'bg-violet-600 border-violet-500 text-white' : 'border-slate-300 text-slate-600 hover:border-slate-400 hover:bg-slate-50'}`}>
                    {compareMode ? 'Exit Compare' : 'Compare Versions'}
                  </button>
                )}
              </div>

              {versions.map(v => (
                <div key={v.id} className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
                  <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">{v.version_label}</p>
                    <p className="text-xs text-slate-500">{new Date(v.created_at).toLocaleString()}</p>
                  </div>
                  {v.ats_score != null && (
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                      v.ats_score >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      v.ats_score >= 60 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      'bg-red-50 text-red-700 border-red-200'
                    }`}>ATS {v.ats_score}%</span>
                  )}
                  {compareMode && (
                    <div className="flex gap-1">
                      <button onClick={() => setV1Id(v.id)}
                        className={`text-xs px-2 py-0.5 rounded border font-medium transition-colors ${v1Id === v.id ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-300 text-slate-600 hover:border-slate-400'}`}>A</button>
                      <button onClick={() => setV2Id(v.id)}
                        className={`text-xs px-2 py-0.5 rounded border font-medium transition-colors ${v2Id === v.id ? 'bg-violet-600 border-violet-500 text-white' : 'border-slate-300 text-slate-600 hover:border-slate-400'}`}>B</button>
                    </div>
                  )}
                  <button onClick={() => deleteVersion(v.id)}
                    className="text-slate-400 hover:text-red-600 transition-colors text-sm font-medium px-1">×</button>
                </div>
              ))}
            </div>

            {/* Compare button */}
            {compareMode && v1Id && v2Id && v1Id !== v2Id && (
              <button onClick={loadDiff} disabled={loadingDiff}
                className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 rounded-xl text-sm font-medium text-white transition-colors">
                {loadingDiff ? 'Computing diff...' : 'Show Diff'}
              </button>
            )}

            {/* Diff viewer */}
            {diff && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-600">
                    {diff.v1.label} to {diff.v2.label}
                  </p>
                  <div className="flex gap-3 text-xs font-medium">
                    <span className="text-emerald-700">+{diff.stats.added}</span>
                    <span className="text-red-700">-{diff.stats.removed}</span>
                    <span className="text-slate-500">={diff.stats.unchanged}</span>
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden font-mono text-xs max-h-96 overflow-y-auto">
                  {diff.diff.map((line, i) => (
                    <div key={i} className={`px-4 py-0.5 ${
                      line.type === 'add' ? 'bg-emerald-50 text-emerald-800' :
                      line.type === 'remove' ? 'bg-red-50 text-red-700 line-through opacity-70' :
                      'text-slate-600'
                    }`}>
                      <span className="select-none mr-2 opacity-50">
                        {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
                      </span>
                      {line.content || ' '}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {selectedId && versions.length === 0 && (
          <div className="text-center py-12 text-slate-500 text-sm">
            No snapshots yet — tailor a resume then click "+ Snapshot"
          </div>
        )}

        {!selectedId && (
          <div className="text-center py-16 text-slate-500 text-sm">
            Select an application to manage resume versions
          </div>
        )}
      </div>
    </div>
  )
}
