import { useEffect, useState, useCallback } from 'react'
import {
  Plus, Trash2, Eye, ChevronDown, ExternalLink, Calendar,
  Target, CheckCircle, XCircle, AlertCircle, Loader2, X, FileText, Download
} from 'lucide-react'
import {
  listApplications, createApplication, updateApplication, deleteApplication, getApplication
} from '../api'
import type { Application, ATSDetails, FitDetails } from '../types'

type StatusFilter = 'all' | Application['status']

const STATUS_CONFIG: Record<Application['status'], { label: string; color: string; bg: string; dot: string }> = {
  saved:     { label: 'Saved',     color: 'text-slate-600',  bg: 'bg-slate-100',   dot: 'bg-slate-400' },
  applied:   { label: 'Applied',   color: 'text-blue-700',   bg: 'bg-blue-50',     dot: 'bg-blue-500' },
  interview: { label: 'Interview', color: 'text-yellow-700', bg: 'bg-yellow-50',   dot: 'bg-yellow-500' },
  offer:     { label: 'Offer',     color: 'text-emerald-700',bg: 'bg-emerald-50',  dot: 'bg-emerald-500' },
  rejected:  { label: 'Rejected',  color: 'text-red-700',    bg: 'bg-red-50',      dot: 'bg-red-500' },
}

const ATS_COLOR = (score: number) =>
  score >= 80 ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
  : score >= 60 ? 'text-yellow-700 bg-yellow-50 border-yellow-200'
  : 'text-red-700 bg-red-50 border-red-200'

function Spinner() {
  return <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
}

interface AddApplicationForm {
  job_title: string
  company: string
  job_url: string
  status: Application['status']
  notes: string
}

const DEFAULT_FORM: AddApplicationForm = {
  job_title: '',
  company: '',
  job_url: '',
  status: 'saved',
  notes: '',
}

// --- Add Application Modal ---
function AddApplicationModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const [form, setForm] = useState<AddApplicationForm>(DEFAULT_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.job_title.trim()) { setError('Job title is required.'); return }
    if (!form.company.trim()) { setError('Company is required.'); return }

    setSaving(true)
    setError('')
    try {
      await createApplication({
        job_title: form.job_title.trim(),
        company: form.company.trim(),
        job_url: form.job_url.trim() || undefined,
        status: form.status,
        notes: form.notes.trim() || undefined,
      })
      onCreated()
    } catch {
      setError('Failed to create application. Please try again.')
      setSaving(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">Add Application</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Job Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.job_title}
              onChange={e => setForm(f => ({ ...f, job_title: e.target.value }))}
              placeholder="e.g. Senior Software Engineer"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Company <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.company}
              onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
              placeholder="e.g. Acme Corp"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Job URL</label>
            <input
              type="url"
              value={form.job_url}
              onChange={e => setForm(f => ({ ...f, job_url: e.target.value }))}
              placeholder="https://..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <select
              value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value as Application['status'] }))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              {(Object.keys(STATUS_CONFIG) as Application['status'][]).map(s => (
                <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3}
              placeholder="Any notes about this application..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition-colors"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Saving...' : 'Add Application'}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  )
}

// --- Fit Score Panel ---
function FitScorePanel({ appId }: { appId: number }) {
  const [fit, setFit] = useState<FitDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [scored, setScored] = useState(false)

  const runScore = async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/fit/${appId}/score`, { method: 'POST' })
      if (!r.ok) throw new Error('Failed')
      const data: FitDetails = await r.json()
      setFit(data)
      setScored(true)
    } catch { /* ignore */ } finally { setLoading(false) }
  }

  useEffect(() => {
    fetch(`/api/fit/${appId}`)
      .then(r => r.json())
      .then((d: FitDetails | { fit_score: null; message: string }) => {
        if (d.fit_score !== null && d.fit_score !== undefined) {
          setFit(d as FitDetails)
          setScored(true)
        }
      })
      .catch(() => {})
  }, [appId])

  const score = fit?.fit_score ?? null
  const scoreColor = score === null
    ? 'text-slate-400'
    : score >= 80 ? 'text-emerald-600'
    : score >= 60 ? 'text-yellow-600'
    : 'text-red-600'
  const barColor = score === null
    ? ''
    : score >= 80 ? 'bg-emerald-500'
    : score >= 60 ? 'bg-yellow-500'
    : 'bg-red-500'

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Job Fit Score</h3>
        <button
          onClick={runScore}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-white transition-colors font-medium"
        >
          {loading && <Loader2 className="w-3 h-3 animate-spin" />}
          {loading ? 'Analyzing...' : scored ? 'Re-score' : 'Analyze Fit'}
        </button>
      </div>

      {score !== null && (
        <div className="flex items-center gap-3">
          <span className={`text-3xl font-bold ${scoreColor}`}>{score}</span>
          <span className="text-slate-400 text-sm">/ 100</span>
          <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${barColor}`}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>
      )}

      {(fit?.met_requirements?.length ?? 0) > 0 && (
        <div>
          <p className="text-xs font-semibold text-emerald-700 mb-1.5 flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" /> Met Requirements
          </p>
          <ul className="space-y-1">
            {fit!.met_requirements.slice(0, 4).map((r, i) => (
              <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                <span className="w-1 h-1 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(fit?.unmet_requirements?.length ?? 0) > 0 && (
        <div>
          <p className="text-xs font-semibold text-red-700 mb-1.5 flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5" /> Missing Requirements
          </p>
          <ul className="space-y-1">
            {fit!.unmet_requirements.slice(0, 4).map((r, i) => (
              <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                <span className="w-1 h-1 rounded-full bg-red-400 mt-1.5 flex-shrink-0" />
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(fit?.skills_gap?.length ?? 0) > 0 && (
        <div>
          <p className="text-xs font-semibold text-yellow-700 mb-1.5 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" /> Skills Gap
          </p>
          <div className="flex flex-wrap gap-1.5">
            {fit!.skills_gap.map((skill, i) => (
              <span key={i} className="px-2 py-0.5 text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-full">
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {(fit?.bridging_suggestions?.length ?? 0) > 0 && (
        <div>
          <p className="text-xs font-semibold text-blue-700 mb-1.5 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" /> Bridging Suggestions
          </p>
          <ul className="space-y-1">
            {fit!.bridging_suggestions.map((s, i) => (
              <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                <span className="w-1 h-1 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!scored && !loading && (
        <p className="text-xs text-slate-400">Click "Analyze Fit" to score this resume against the job description.</p>
      )}
    </div>
  )
}

// --- Company Brief Card ---
function CompanyBriefCard({ company, jobTitle }: { company: string; jobTitle: string }) {
  const [brief, setBrief] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const load = async (bust = false) => {
    setLoading(true)
    try {
      if (bust) {
        await fetch(`/api/company/research/${encodeURIComponent(company)}`, { method: 'DELETE' })
      }
      const r = await fetch('/api/company/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_name: company, job_title: jobTitle }),
      })
      if (r.ok) setBrief(await r.json())
    } catch { /* ignore */ } finally { setLoading(false) }
  }

  useEffect(() => {
    // Try cache first, fall back to generating
    fetch(`/api/company/research/${encodeURIComponent(company)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setBrief(d); else load() })
      .catch(() => load())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company])

  if (loading) return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Company Intel</h3>
      </div>
      <p className="text-xs text-slate-400 animate-pulse">Researching {company}…</p>
    </div>
  )

  if (!brief) return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Company Intel</h3>
        <button
          onClick={() => load()}
          className="text-xs px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors"
        >
          Research
        </button>
      </div>
    </div>
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Company Intel</h3>
        <button
          onClick={() => load(true)}
          className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Funding & headcount badges */}
      <div className="flex flex-wrap gap-2">
        {brief.funding_stage && brief.funding_stage !== 'Unknown' && (
          <span className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
            {brief.funding_stage}
          </span>
        )}
        {brief.headcount_trend && brief.headcount_trend !== 'Unknown' && (
          <span className="text-xs px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full">
            {brief.headcount_trend}
          </span>
        )}
      </div>

      {/* Recent news */}
      {brief.recent_news?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-1.5">Recent News</p>
          <ul className="space-y-1.5">
            {brief.recent_news.map((n: any, i: number) => (
              <li key={i} className="text-xs text-slate-700">
                <span className="text-slate-400">{n.date} — </span>{n.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Glassdoor sentiment */}
      {brief.glassdoor_sentiment && brief.glassdoor_sentiment !== 'No data found' && (
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-1">Employee Sentiment</p>
          <p className="text-xs text-slate-700 leading-relaxed">{brief.glassdoor_sentiment}</p>
        </div>
      )}

      {/* Interview patterns */}
      {brief.interview_patterns?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-1.5">Interview Process</p>
          <ul className="space-y-1">
            {brief.interview_patterns.map((p: string, i: number) => (
              <li key={i} className="text-xs text-slate-700 flex gap-2">
                <span className="text-violet-500 flex-shrink-0">•</span>{p}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tech stack (stored in raw_signals column) */}
      {brief.raw_signals?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-1.5">Tech Stack</p>
          <div className="flex flex-wrap gap-1.5">
            {brief.raw_signals.map((t: string, i: number) => (
              <span key={i} className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// --- Outreach Panel ---
function OutreachPanel({ appId }: { appId: number }) {
  const [type, setType] = useState<'linkedin' | 'cold_email'>('linkedin')
  const [contactName, setContactName] = useState('')
  const [contactTitle, setContactTitle] = useState('')
  const [drafts, setDrafts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState<number | null>(null)

  useEffect(() => {
    fetch(`/api/outreach/${appId}`).then(r => r.json()).then(setDrafts).catch(() => {})
  }, [appId])

  const generate = async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/outreach/${appId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outreach_type: type, contact_name: contactName, contact_title: contactTitle }),
      })
      if (r.ok) { const d = await r.json(); setDrafts(prev => [d, ...prev]) }
    } finally { setLoading(false) }
  }

  const copy = (id: number, text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(['linkedin', 'cold_email'] as const).map(t => (
          <button key={t} onClick={() => setType(t)}
            className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${type === t ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-300 text-slate-500 hover:border-slate-400'}`}>
            {t === 'linkedin' ? 'LinkedIn Message' : 'Cold Email'}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input value={contactName} onChange={e => setContactName(e.target.value)}
          placeholder="Contact name (optional)"
          className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-blue-500" />
        <input value={contactTitle} onChange={e => setContactTitle(e.target.value)}
          placeholder="Contact title (optional)"
          className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-blue-500" />
      </div>
      <button onClick={generate} disabled={loading}
        className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-xs font-medium text-white transition-colors">
        {loading ? 'Generating…' : '+ Generate Message'}
      </button>
      {drafts.map(d => (
        <div key={d.id} className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 capitalize">{d.outreach_type === 'linkedin' ? 'LinkedIn' : 'Email'}</span>
            <button onClick={() => copy(d.id, d.draft_text)}
              className="text-[10px] px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors">
              {copied === d.id ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{d.draft_text}</p>
        </div>
      ))}
    </div>
  )
}

// --- Email Drafts Panel ---
function EmailDraftsPanel({ appId }: { appId: number; jobTitle: string; company: string }) {
  const [drafts, setDrafts] = useState<any[]>([])
  const [loading, setLoading] = useState<string | null>(null)
  const [copied, setCopied] = useState<number | null>(null)

  const EMAIL_TYPES = [
    { key: 'cold_outreach', label: 'Cold Outreach' },
    { key: 'followup_1w', label: 'Follow-up (1w)' },
    { key: 'followup_2w', label: 'Follow-up (2w)' },
    { key: 'thank_you', label: 'Thank You' },
    { key: 'negotiation', label: 'Negotiation' },
  ]

  useEffect(() => {
    fetch(`/api/emails/${appId}`).then(r => r.json()).then(setDrafts).catch(() => {})
  }, [appId])

  const generate = async (emailType: string) => {
    setLoading(emailType)
    try {
      const r = await fetch(`/api/emails/${appId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_type: emailType }),
      })
      if (r.ok) { const d = await r.json(); setDrafts(prev => [d, ...prev]) }
    } finally { setLoading(null) }
  }

  const copy = (id: number, subject: string, body: string) => {
    navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {EMAIL_TYPES.map(t => (
          <button key={t.key} onClick={() => generate(t.key)} disabled={loading === t.key}
            className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg text-slate-700 transition-colors border border-slate-200">
            {loading === t.key ? '…' : `+ ${t.label}`}
          </button>
        ))}
      </div>
      {drafts.map(d => (
        <div key={d.id} className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-blue-600">{d.label || d.email_type}</span>
            <button onClick={() => copy(d.id, d.subject, d.body)}
              className="text-[10px] px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors">
              {copied === d.id ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          {d.subject && <p className="text-xs text-slate-500">Subject: {d.subject}</p>}
          <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{d.body}</p>
        </div>
      ))}
    </div>
  )
}

// --- Application Detail Modal ---
async function downloadPdf(text: string, filename: string) {
  const r = await fetch('/api/resumes/download-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, filename }),
  })
  if (!r.ok) throw new Error('Failed')
  const blob = await r.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = `${filename}.pdf`; a.click()
  URL.revokeObjectURL(url)
}

function ApplicationDetailModal({
  application,
  onClose,
}: {
  application: Application
  onClose: () => void
}) {
  const [dlResume, setDlResume] = useState(false)
  const [dlLetter, setDlLetter] = useState(false)
  const cfg = STATUS_CONFIG[application.status]
  const ats = application.ats_details as ATSDetails | undefined

  return (
    <ModalOverlay onClose={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">{application.job_title}</h2>
            <p className="text-sm text-slate-500 mt-0.5">{application.company}</p>
          </div>
          <div className="flex items-center gap-3 ml-4">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5 scrollbar-thin">
          {/* Meta */}
          <div className="flex flex-wrap gap-4 text-sm text-slate-600">
            {application.job_url && (
              <a
                href={application.job_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                View Job Posting
              </a>
            )}
            {application.applied_at && (
              <span className="flex items-center gap-1.5 text-slate-500">
                <Calendar className="w-4 h-4" />
                Applied {new Date(application.applied_at).toLocaleDateString()}
              </span>
            )}
            {application.ats_score != null && (
              <span className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${ATS_COLOR(application.ats_score)}`}>
                <Target className="w-3.5 h-3.5" />
                ATS Score: {application.ats_score}%
              </span>
            )}
          </div>

          {/* Notes */}
          {application.notes && (
            <DetailSection title="Notes">
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{application.notes}</p>
            </DetailSection>
          )}

          {/* Job Fit Score */}
          <DetailSection title="Job Fit">
            <FitScorePanel appId={application.id} />
          </DetailSection>

          {/* Company Intel */}
          {application.company && (
            <DetailSection title="Company Intel">
              <CompanyBriefCard company={application.company} jobTitle={application.job_title} />
            </DetailSection>
          )}

          {/* ATS Details */}
          {ats && (
            <DetailSection title="ATS Analysis">
              <div className="space-y-3">
                {ats.matched_keywords?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-emerald-700 mb-1.5 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Matched Keywords
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {ats.matched_keywords.map(kw => (
                        <span key={kw} className="px-2 py-0.5 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {ats.missing_keywords?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-red-700 mb-1.5 flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5" /> Missing Keywords
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {ats.missing_keywords.map(kw => (
                        <span key={kw} className="px-2 py-0.5 text-xs bg-red-50 text-red-700 border border-red-200 rounded-full">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {ats.recommendations?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-blue-700 mb-1.5 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> Recommendations
                    </p>
                    <ul className="space-y-1">
                      {ats.recommendations.map((rec, i) => (
                        <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </DetailSection>
          )}

          {/* Job Description */}
          {application.job_description && (
            <DetailSection title="Job Description">
              <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans leading-relaxed max-h-48 overflow-y-auto scrollbar-thin">
                {application.job_description}
              </pre>
            </DetailSection>
          )}

          {/* Tailored Resume */}
          {application.tailored_resume && (
            <DetailSection title="Tailored Resume">
              <div className="flex justify-end mb-2">
                <button
                  onClick={async () => {
                    setDlResume(true)
                    try { await downloadPdf(application.tailored_resume!, `${application.company}_${application.job_title}_Resume`) }
                    catch { alert('Failed to download PDF') }
                    finally { setDlResume(false) }
                  }}
                  disabled={dlResume}
                  className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors disabled:opacity-60"
                >
                  {dlResume ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  Download PDF
                </button>
              </div>
              <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans leading-relaxed max-h-48 overflow-y-auto scrollbar-thin">
                {application.tailored_resume}
              </pre>
            </DetailSection>
          )}

          {/* Cover Letter */}
          {application.cover_letter && (
            <DetailSection title="Cover Letter">
              <div className="flex justify-end mb-2">
                <button
                  onClick={async () => {
                    setDlLetter(true)
                    try { await downloadPdf(application.cover_letter!, `${application.company}_${application.job_title}_CoverLetter`) }
                    catch { alert('Failed to download PDF') }
                    finally { setDlLetter(false) }
                  }}
                  disabled={dlLetter}
                  className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors disabled:opacity-60"
                >
                  {dlLetter ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  Download PDF
                </button>
              </div>
              <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans leading-relaxed max-h-48 overflow-y-auto scrollbar-thin">
                {application.cover_letter}
              </pre>
            </DetailSection>
          )}

          {/* Networking Outreach */}
          <DetailSection title="Networking Outreach">
            <OutreachPanel appId={application.id} />
          </DetailSection>

          {/* Email Drafts */}
          <DetailSection title="Email Drafts">
            <EmailDraftsPanel appId={application.id} jobTitle={application.job_title} company={application.company} />
          </DetailSection>
        </div>
      </div>
    </ModalOverlay>
  )
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{title}</h3>
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
        {children}
      </div>
    </div>
  )
}

// --- Application Card ---
function ApplicationCard({
  app,
  onViewDetails,
  onStatusChange,
  onDelete,
}: {
  app: Application
  onViewDetails: (app: Application) => void
  onStatusChange: (id: number, status: Application['status']) => void
  onDelete: (id: number) => void
}) {
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const cfg = STATUS_CONFIG[app.status]

  const handleDelete = async () => {
    if (!confirm(`Delete application for "${app.job_title}" at ${app.company}?`)) return
    setDeleting(true)
    onDelete(app.id)
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-shadow duration-200 flex flex-col gap-3">
      {/* Top Row: Title + Status */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-800 text-base leading-tight truncate">
            {app.job_title}
          </h3>
          <p className="text-sm text-slate-500 mt-0.5 truncate">{app.company}</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${cfg.bg} ${cfg.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
          {cfg.label}
        </span>
      </div>

      {/* ATS Score + Applied Date */}
      <div className="flex items-center gap-3 flex-wrap">
        {app.ats_score != null && (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${ATS_COLOR(app.ats_score)}`}>
            <Target className="w-3 h-3" />
            {app.ats_score}% ATS
          </span>
        )}
        {app.fit_score != null && (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
            app.fit_score >= 80 ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
            : app.fit_score >= 60 ? 'text-yellow-700 bg-yellow-50 border-yellow-200'
            : 'text-red-700 bg-red-50 border-red-200'
          }`}>
            Fit {app.fit_score}%
          </span>
        )}
        {app.applied_at && (
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <Calendar className="w-3.5 h-3.5" />
            {new Date(app.applied_at).toLocaleDateString()}
          </span>
        )}
        {app.job_url && (
          <a
            href={app.job_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 transition-colors"
            onClick={e => e.stopPropagation()}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Link
          </a>
        )}
      </div>

      {/* Notes preview */}
      {app.notes && (
        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{app.notes}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-slate-100 mt-auto">
        <button
          onClick={() => onViewDetails(app)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
        >
          <Eye className="w-3.5 h-3.5" />
          View Details
        </button>

        {/* Status Change */}
        <div className="relative">
          <button
            onClick={() => setShowStatusMenu(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Status
            <ChevronDown className="w-3 h-3" />
          </button>
          {showStatusMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowStatusMenu(false)} />
              <div className="absolute left-0 top-full mt-1 w-36 bg-white border border-slate-200 rounded-lg shadow-lg z-20 overflow-hidden">
                {(Object.keys(STATUS_CONFIG) as Application['status'][]).map(s => (
                  <button
                    key={s}
                    onClick={() => {
                      onStatusChange(app.id, s)
                      setShowStatusMenu(false)
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-slate-50 transition-colors ${
                      app.status === s ? 'font-semibold text-blue-600' : 'text-slate-700'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[s].dot}`} />
                    {STATUS_CONFIG[s].label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <button
          onClick={handleDelete}
          disabled={deleting}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
        >
          {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          Delete
        </button>
      </div>
    </div>
  )
}

// --- Modal Overlay ---
function ModalOverlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {children}
    </div>
  )
}

// --- Filter Tabs ---
const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'saved', label: 'Saved' },
  { value: 'applied', label: 'Applied' },
  { value: 'interview', label: 'Interview' },
  { value: 'offer', label: 'Offer' },
  { value: 'rejected', label: 'Rejected' },
]

// --- Dashboard Page ---
export default function Dashboard() {
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedApp, setSelectedApp] = useState<Application | null>(null)

  const fetchApplications = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await listApplications(filter === 'all' ? undefined : filter)
      setApplications(Array.isArray(data) ? data : [])
    } catch {
      setError('Failed to load applications. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    fetchApplications()
  }, [fetchApplications])

  const handleStatusChange = async (id: number, status: Application['status']) => {
    try {
      await updateApplication(id, { status })
      setApplications(prev => prev.map(a => a.id === id ? { ...a, status } : a))
    } catch {
      alert('Failed to update status.')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteApplication(id)
      setApplications(prev => prev.filter(a => a.id !== id))
    } catch {
      alert('Failed to delete application.')
    }
  }

  const handleViewDetails = async (app: Application) => {
    try {
      const full = await getApplication(app.id)
      setSelectedApp(full)
    } catch {
      setSelectedApp(app)
    }
  }

  const handleCreated = () => {
    setShowAddModal(false)
    fetchApplications()
  }

  // Stats summary
  const stats = {
    total: applications.length,
    applied: applications.filter(a => a.status === 'applied').length,
    interview: applications.filter(a => a.status === 'interview').length,
    offer: applications.filter(a => a.status === 'offer').length,
  }

  return (
    <div className="p-6 min-h-full">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Applications</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track and manage your job applications</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add Application
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total" value={stats.total} color="text-slate-700" bg="bg-white" />
        <StatCard label="Applied" value={stats.applied} color="text-blue-700" bg="bg-blue-50" />
        <StatCard label="Interview" value={stats.interview} color="text-yellow-700" bg="bg-yellow-50" />
        <StatCard label="Offer" value={stats.offer} color="text-emerald-700" bg="bg-emerald-50" />
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 mb-5 bg-slate-100 p-1 rounded-lg w-fit flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              filter === f.value
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner />
        </div>
      ) : applications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-slate-700 mb-1">No applications yet</h3>
          <p className="text-sm text-slate-500 mb-4 max-w-sm">
            {filter === 'all'
              ? "Start tracking your job search by adding your first application."
              : `No applications with status "${filter}".`}
          </p>
          {filter === 'all' && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Application
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {applications.map(app => (
            <ApplicationCard
              key={app.id}
              app={app}
              onViewDetails={handleViewDetails}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showAddModal && (
        <AddApplicationModal
          onClose={() => setShowAddModal(false)}
          onCreated={handleCreated}
        />
      )}
      {selectedApp && (
        <ApplicationDetailModal
          application={selectedApp}
          onClose={() => setSelectedApp(null)}
        />
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  color,
  bg,
}: {
  label: string
  value: number
  color: string
  bg: string
}) {
  return (
    <div className={`${bg} border border-slate-200 rounded-xl px-4 py-3`}>
      <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  )
}
