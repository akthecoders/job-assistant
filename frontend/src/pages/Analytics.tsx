import { useState, useEffect } from 'react'

interface FunnelStage { stage: string; count: number }
interface FunnelData { funnel: FunnelStage[]; total_active: number; response_rate: number }
interface PatternData { by_day_of_week: any[]; score_stats: any; ghost_stats: any }
interface DiagnosticData { tips: string[]; counts: Record<string, number> }

const STAGE_COLORS: Record<string, string> = {
  saved: 'bg-slate-600',
  applied: 'bg-blue-500',
  interview: 'bg-violet-500',
  offer: 'bg-emerald-500',
  rejected: 'bg-red-500/60',
}

const STAGE_LABELS: Record<string, string> = {
  saved: 'Saved',
  applied: 'Applied',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
}

export default function Analytics() {
  const [funnel, setFunnel] = useState<FunnelData | null>(null)
  const [patterns, setPatterns] = useState<PatternData | null>(null)
  const [diagnostics, setDiagnostics] = useState<DiagnosticData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch('/api/analytics/funnel').then(r => r.json()),
      fetch('/api/analytics/patterns').then(r => r.json()),
      fetch('/api/analytics/diagnostics').then(r => r.json()),
    ]).then(([f, p, d]) => {
      setFunnel(f)
      setPatterns(p)
      setDiagnostics(d)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const maxCount = funnel ? Math.max(...funnel.funnel.map(s => s.count), 1) : 1
  const maxDow = patterns ? Math.max(...patterns.by_day_of_week.map((d: any) => d.applications), 1) : 1

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 px-6 py-5 border-b border-white/5">
        <h1 className="text-xl font-semibold text-slate-100">Analytics</h1>
        <p className="text-sm text-slate-500 mt-0.5">Application funnel and performance patterns</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        {loading && <p className="text-slate-500 text-sm animate-pulse">Loading analytics...</p>}

        {/* Funnel */}
        {funnel && (
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-200">Application Funnel</h2>
              <span className="text-xs text-slate-500">{funnel.response_rate}% response rate</span>
            </div>
            <div className="space-y-3">
              {funnel.funnel.map(s => (
                <div key={s.stage} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 capitalize">{STAGE_LABELS[s.stage] || s.stage}</span>
                    <span className="text-slate-300 font-medium">{s.count}</span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${STAGE_COLORS[s.stage] || 'bg-slate-500'}`}
                      style={{ width: `${(s.count / maxCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Day of week */}
        {patterns !== null && patterns.by_day_of_week?.length > 0 && (
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-200">Applications by Day</h2>
            <div className="flex items-end gap-2 h-24">
              {patterns.by_day_of_week.map((d: any) => (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col items-center justify-end" style={{ height: '80px' }}>
                    <div
                      className="w-full bg-blue-500/60 rounded-t"
                      style={{ height: `${(d.applications / maxDow) * 70}px`, minHeight: d.applications ? '4px' : '0' }}
                    />
                    {d.responses > 0 && (
                      <div
                        className="w-full bg-emerald-500 rounded-t -mt-1"
                        style={{ height: `${(d.responses / maxDow) * 70}px`, minHeight: '2px' }}
                      />
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500">{d.day}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-4 text-[10px] text-slate-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500/60 inline-block" />Applications</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" />Responses</span>
            </div>
          </div>
        )}

        {/* Score stats */}
        {patterns !== null && patterns.score_stats?.total > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Avg ATS Score', value: Math.round(patterns.score_stats.avg_ats || 0), suffix: '%' },
              { label: 'Avg Fit Score', value: Math.round(patterns.score_stats.avg_fit || 0), suffix: '%' },
              { label: 'Ghost Jobs', value: patterns.ghost_stats?.likely_ghost || 0, suffix: ` of ${patterns.ghost_stats?.total || 0}` },
            ].map(s => (
              <div key={s.label} className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-slate-100">{s.value}<span className="text-sm text-slate-500">{s.suffix}</span></p>
                <p className="text-[10px] text-slate-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Diagnostics */}
        {diagnostics !== null && diagnostics.tips?.length > 0 && (
          <div className="bg-blue-950/30 border border-blue-900/40 rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-blue-300">Recommendations</h2>
            <ul className="space-y-2">
              {diagnostics.tips.map((tip, i) => (
                <li key={i} className="text-xs text-slate-300 flex gap-2">
                  <span className="text-blue-400 shrink-0">-&gt;</span>{tip}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
