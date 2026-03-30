import React from 'react'
import type { AtsDetails } from '../App'

export default function ATSScore({ atsDetails }: { atsDetails: AtsDetails }) {
  const { score, matched_keywords, missing_keywords, recommendations } = atsDetails

  const r = 32
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ

  const color = score >= 80
    ? { stroke: '#34d399', text: 'text-emerald-400', label: 'Excellent', bar: 'bg-emerald-500' }
    : score >= 60
    ? { stroke: '#f59e0b', text: 'text-amber-400', label: 'Good', bar: 'bg-amber-500' }
    : { stroke: '#f87171', text: 'text-red-400', label: 'Needs Work', bar: 'bg-red-500' }

  return (
    <div className="bg-[#1e293b] rounded-2xl border border-white/5 p-4 space-y-3">

      {/* Score row */}
      <div className="flex items-center gap-4">
        {/* Ring */}
        <div className="relative shrink-0">
          <svg width="76" height="76" className="-rotate-90">
            <circle cx="38" cy="38" r={r} fill="none" stroke="#1e293b" strokeWidth="7" />
            <circle
              cx="38" cy="38" r={r} fill="none"
              stroke={color.stroke} strokeWidth="7" strokeLinecap="round"
              strokeDasharray={circ} strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-lg font-bold leading-none ${color.text}`}>{score}</span>
            <span className="text-[9px] text-slate-600 leading-none">/100</span>
          </div>
        </div>

        {/* Info */}
        <div className="flex-1">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">ATS Match</p>
          <p className={`text-base font-bold ${color.text} mb-1.5`}>{color.label}</p>
          {/* Mini bar */}
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${color.bar} transition-all duration-700`}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>
      </div>

      {/* Keywords */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] font-medium text-emerald-400 mb-1.5 flex items-center gap-1">
            ✓ Matched <span className="text-emerald-700">({matched_keywords.length})</span>
          </p>
          <div className="flex flex-wrap gap-1">
            {matched_keywords.slice(0, 5).map(kw => (
              <span key={kw} className="text-[10px] px-1.5 py-0.5 bg-emerald-950/60 text-emerald-300 border border-emerald-800/50 rounded-md">
                {kw}
              </span>
            ))}
            {matched_keywords.length > 5 && (
              <span className="text-[10px] text-slate-600">+{matched_keywords.length - 5}</span>
            )}
            {matched_keywords.length === 0 && (
              <span className="text-[10px] text-slate-600">None detected</span>
            )}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-medium text-red-400 mb-1.5 flex items-center gap-1">
            ✕ Missing <span className="text-red-800">({missing_keywords.length})</span>
          </p>
          <div className="flex flex-wrap gap-1">
            {missing_keywords.slice(0, 5).map(kw => (
              <span key={kw} className="text-[10px] px-1.5 py-0.5 bg-red-950/60 text-red-300 border border-red-900/50 rounded-md">
                {kw}
              </span>
            ))}
            {missing_keywords.length > 5 && (
              <span className="text-[10px] text-slate-600">+{missing_keywords.length - 5}</span>
            )}
            {missing_keywords.length === 0 && (
              <span className="text-[10px] text-slate-600">None missing 🎉</span>
            )}
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="border-t border-white/5 pt-3 space-y-1.5">
          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Suggestions</p>
          {recommendations.map((r, i) => (
            <div key={i} className="flex items-start gap-2 text-[11px] text-slate-400">
              <span className="text-blue-500 mt-0.5 shrink-0">›</span>
              <span className="leading-relaxed">{r}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
