import React, { useState } from 'react'
import type { JobData, Resume } from '../App'

interface Props {
  jobData: JobData
  defaultResume: Resume | null
  onTailorResume: () => void
  onCoverLetter: () => void
  onSaveApplication: () => void
  isLoading: boolean
  saved: boolean
  backendOk: boolean
}

const SOURCE_COLORS: Record<string, string> = {
  LinkedIn:    'bg-blue-500/15 text-blue-300 border-blue-500/20',
  Indeed:      'bg-violet-500/15 text-violet-300 border-violet-500/20',
  Glassdoor:   'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  ZipRecruiter:'bg-orange-500/15 text-orange-300 border-orange-500/20',
  Monster:     'bg-rose-500/15 text-rose-300 border-rose-500/20',
}

export default function JobInfo({ jobData, defaultResume, onTailorResume, onCoverLetter, onSaveApplication, isLoading, saved, backendOk }: Props) {
  const [descExpanded, setDescExpanded] = useState(false)
  const previewLen = 280
  const hasMore = jobData.description.length > previewLen
  const sourceCls = SOURCE_COLORS[jobData.source] ?? 'bg-white/5 text-slate-400 border-white/10'

  const noResume = !defaultResume
  const canAct = backendOk && !isLoading && !noResume

  return (
    <div className="p-3 space-y-2.5">

      {/* ── Job card ── */}
      <div className="bg-[#1e293b] rounded-2xl p-4 border border-white/5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${sourceCls}`}>
            {jobData.source}
          </span>
          <span className="text-[10px] text-slate-600 shrink-0">
            {new Date(jobData.extractedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <div>
          <h2 className="font-bold text-slate-100 leading-snug mb-0.5">{jobData.jobTitle}</h2>
          {jobData.company && (
            <p className="text-[12px] text-slate-400 font-medium">{jobData.company}</p>
          )}
          {jobData.location && (
            <p className="text-[11px] text-slate-600 mt-0.5">📍 {jobData.location}</p>
          )}
        </div>

        <button
          onClick={() => chrome.tabs.create({ url: jobData.url })}
          className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
        >
          View posting ↗
        </button>
      </div>

      {/* ── Resume in use ── */}
      <div className={`rounded-2xl p-3 border flex items-center justify-between gap-2 ${
        noResume
          ? 'bg-amber-950/30 border-amber-900/40'
          : 'bg-[#1e293b] border-white/5'
      }`}>
        {noResume ? (
          <>
            <div>
              <p className="text-[11px] font-semibold text-amber-400">No resume uploaded</p>
              <p className="text-[10px] text-amber-600/80 mt-0.5">Add one in the dashboard first</p>
            </div>
            <button
              onClick={() => chrome.tabs.create({ url: 'http://localhost:8000/resumes' })}
              className="text-[11px] text-amber-400 hover:text-amber-300 border border-amber-800 rounded-lg px-2.5 py-1 whitespace-nowrap"
            >
              Add Resume ↗
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-blue-500/15 border border-blue-500/20 flex items-center justify-center text-sm shrink-0">
                📄
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-slate-500 leading-none mb-0.5">Using resume</p>
                <p className="text-[12px] font-medium text-slate-200 truncate">{defaultResume.name}</p>
              </div>
            </div>
            <button
              onClick={() => chrome.tabs.create({ url: 'http://localhost:8000/resumes' })}
              className="text-[10px] text-slate-500 hover:text-slate-300 shrink-0 transition-colors"
            >
              Change ↗
            </button>
          </>
        )}
      </div>

      {/* ── Action buttons ── */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onTailorResume}
          disabled={!canAct}
          className="flex flex-col items-center justify-center gap-1.5 py-3.5 bg-blue-600 hover:bg-blue-500 disabled:bg-white/5 disabled:text-slate-600 text-white rounded-2xl transition-colors font-medium"
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <span className="text-lg">✏️</span>
          )}
          <span className="text-[11px]">Tailor Resume</span>
        </button>

        <button
          onClick={onCoverLetter}
          disabled={!canAct}
          className="flex flex-col items-center justify-center gap-1.5 py-3.5 bg-violet-600/80 hover:bg-violet-600 disabled:bg-white/5 disabled:text-slate-600 text-white rounded-2xl transition-colors font-medium"
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <span className="text-lg">📝</span>
          )}
          <span className="text-[11px]">Cover Letter</span>
        </button>
      </div>

      <button
        onClick={onSaveApplication}
        disabled={isLoading || !backendOk || saved}
        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl text-[12px] font-medium transition-all border ${
          saved
            ? 'bg-emerald-950/50 border-emerald-800/50 text-emerald-400'
            : 'bg-transparent border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200 disabled:opacity-30'
        }`}
      >
        {saved ? '✓ Saved to Tracker' : '🔖 Save to Tracker'}
      </button>

      {/* ── Job description ── */}
      {jobData.description && (
        <div className="bg-[#1e293b] rounded-2xl border border-white/5 overflow-hidden">
          <button
            onClick={() => setDescExpanded(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-[11px] font-medium text-slate-400 hover:text-slate-200 transition-colors"
          >
            <span>Job Description</span>
            <span className="text-slate-600">{descExpanded ? '▲' : '▼'}</span>
          </button>
          {descExpanded && (
            <div className="px-4 pb-4 pt-1 border-t border-white/5">
              <p className="text-[11px] text-slate-400 leading-relaxed whitespace-pre-wrap break-words">
                {jobData.description}
              </p>
            </div>
          )}
          {!descExpanded && (
            <div className="px-4 pb-3 -mt-1">
              <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-3">
                {jobData.description.slice(0, previewLen)}{hasMore ? '…' : ''}
              </p>
            </div>
          )}
        </div>
      )}

      {!backendOk && (
        <div className="bg-amber-950/30 border border-amber-900/40 rounded-2xl p-3 text-[11px] text-amber-500">
          <p className="font-semibold text-amber-400 mb-0.5">Backend offline</p>
          Run <code className="bg-black/30 px-1 rounded">./start.sh</code> to enable AI features.
        </div>
      )}
    </div>
  )
}
