import { useState, useEffect } from 'react'
import { listResumes } from '../api'
import type { Resume } from '../types'

export default function LinkedInOptimizer() {
  const [headline, setHeadline] = useState('')
  const [summary, setSummary] = useState('')
  const [resumeId, setResumeId] = useState<number | ''>('')
  const [resumes, setResumes] = useState<Resume[]>([])
  const [result, setResult] = useState<{ headline?: string; summary?: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    listResumes().then(setResumes).catch(() => {})
  }, [])

  const optimize = async () => {
    if (!headline.trim() && !summary.trim()) return
    setLoading(true)
    try {
      const r = await fetch('/api/linkedin/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headline,
          summary,
          resume_id: resumeId || null,
        }),
      })
      if (r.ok) setResult(await r.json())
    } finally {
      setLoading(false)
    }
  }

  const copy = (key: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 px-6 py-5 border-b border-slate-200">
        <h1 className="text-xl font-semibold text-slate-800">LinkedIn Optimizer</h1>
        <p className="text-sm text-slate-500 mt-0.5">Rewrite your headline and summary to attract more recruiters</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* Resume context picker */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Resume context (optional)</label>
          <select
            value={resumeId}
            onChange={e => setResumeId(e.target.value ? Number(e.target.value) : '')}
            className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">No resume context</option>
            {resumes.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>

        {/* Headline input */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-600">Current Headline</label>
            <span className="text-xs text-slate-400">{headline.length} / 220</span>
          </div>
          <input
            value={headline}
            onChange={e => setHeadline(e.target.value)}
            placeholder="e.g. Senior Frontend Engineer at Acme Corp"
            maxLength={220}
            className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Summary input */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Current Summary / About</label>
          <textarea
            value={summary}
            onChange={e => setSummary(e.target.value)}
            placeholder="Paste your current LinkedIn About section here…"
            rows={6}
            className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        </div>

        <button
          onClick={optimize}
          disabled={loading || (!headline.trim() && !summary.trim())}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl text-sm font-medium text-white transition-colors"
        >
          {loading ? 'Optimizing…' : 'Optimize with AI'}
        </button>

        {/* Results */}
        {result && (
          <div className="space-y-4">
            {result.headline && (
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Optimized Headline</p>
                  <button
                    onClick={() => copy('headline', result.headline!)}
                    className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
                  >
                    {copied === 'headline' ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
                <p className="text-sm text-slate-800 leading-relaxed">{result.headline}</p>
                <p className="text-xs text-slate-400">{result.headline.length} characters</p>
              </div>
            )}

            {result.summary && (
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Optimized Summary</p>
                  <button
                    onClick={() => copy('summary', result.summary!)}
                    className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
                  >
                    {copied === 'summary' ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{result.summary}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
