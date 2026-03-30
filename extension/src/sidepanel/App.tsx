import React, { useCallback, useEffect, useRef, useState } from 'react'
import JobInfo from './components/JobInfo'
import ResumeSection from './components/ResumeSection'
import CoverLetterSection from './components/CoverLetterSection'

export interface JobData {
  jobTitle: string
  company: string
  location: string
  description: string
  url: string
  source: string
  extractedAt: string
  postedAt: string | null    // NEW
  boardSignals: string[]     // NEW
}

export interface Resume {
  id: number
  name: string
  content?: string
  preview?: string
  is_default: number
  created_at: string
}

export interface AtsDetails {
  score: number
  matched_keywords: string[]
  missing_keywords: string[]
  recommendations: string[]
}

export interface TailoredResumeResult {
  tailored_resume: string
  ats_score: number
  ats_details: AtsDetails
}

export interface CoverLetterResult {
  cover_letter: string
}

type ActiveTab = 'job' | 'resume' | 'cover-letter'

const API = 'http://localhost:8000'

export default function App() {
  const [jobData, setJobData] = useState<JobData | null>(null)
  const [defaultResume, setDefaultResume] = useState<Resume | null>(null)
  const [tailoredResume, setTailoredResume] = useState<TailoredResumeResult | null>(null)
  const [coverLetter, setCoverLetter] = useState<CoverLetterResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [activeTab, setActiveTab] = useState<ActiveTab>('job')
  const [backendOk, setBackendOk] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const prevJobKey = useRef<string | null>(null)

  // ── health & resume load ─────────────────────────────────────────────────
  const checkHealth = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/ai/health`, { signal: AbortSignal.timeout(3000) })
      setBackendOk(r.ok)
    } catch { setBackendOk(false) }
  }, [])

  const loadDefaultResume = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/resumes`, { signal: AbortSignal.timeout(5000) })
      if (!r.ok) return
      const list: Resume[] = await r.json()
      if (!list.length) return
      const def = list.find(x => x.is_default === 1) ?? list[0]
      setDefaultResume(def)
    } catch { /* backend offline */ }
  }, [])

  // ── job storage listener ─────────────────────────────────────────────────
  // Key = url + jobTitle so same-URL page navigations (LinkedIn collections) still trigger updates
  function jobKey(job: JobData) { return `${job.url}||${job.jobTitle}` }

  const applyJob = useCallback((job: JobData) => {
    if (jobKey(job) === prevJobKey.current) return
    prevJobKey.current = jobKey(job)
    setJobData(job)
    setTailoredResume(null)
    setCoverLetter(null)
    setSaved(false)
    setActiveTab('job')
    setError(null)
  }, [])

  const readJob = useCallback(() => {
    chrome.storage.local.get('currentJob', (res) => {
      const job = res.currentJob as JobData | undefined
      if (job) applyJob(job)
    })
  }, [applyJob])

  useEffect(() => {
    checkHealth()
    loadDefaultResume()
    readJob()
    const healthTimer = setInterval(checkHealth, 30_000)
    const onChange = (changes: Record<string, chrome.storage.StorageChange>) => {
      const job = changes.currentJob?.newValue as JobData | undefined
      if (job) applyJob(job)
    }
    chrome.storage.local.onChanged.addListener(onChange)
    return () => {
      clearInterval(healthTimer)
      chrome.storage.local.onChanged.removeListener(onChange)
    }
  }, [checkHealth, loadDefaultResume, readJob, applyJob])

  // ── actions ──────────────────────────────────────────────────────────────
  const handleTailorResume = useCallback(async () => {
    if (!jobData || !defaultResume) return
    setIsLoading(true); setLoadingMsg('Tailoring resume…'); setError(null)
    try {
      const r = await fetch(`${API}/api/ai/tailor-resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume_id: defaultResume.id, job_description: jobData.description }),
        signal: AbortSignal.timeout(120_000),
      })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail ?? `Error ${r.status}`)
      setTailoredResume(await r.json())
      setActiveTab('resume')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to tailor resume.')
    } finally { setIsLoading(false); setLoadingMsg('') }
  }, [jobData, defaultResume])

  const handleCoverLetter = useCallback(async () => {
    if (!jobData || !defaultResume) return
    setIsLoading(true); setLoadingMsg('Writing cover letter…'); setError(null)
    try {
      const r = await fetch(`${API}/api/ai/cover-letter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resume_id: defaultResume.id,
          job_description: jobData.description,
          company: jobData.company,
          role: jobData.jobTitle,
        }),
        signal: AbortSignal.timeout(120_000),
      })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail ?? `Error ${r.status}`)
      setCoverLetter(await r.json())
      setActiveTab('cover-letter')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate cover letter.')
    } finally { setIsLoading(false); setLoadingMsg('') }
  }, [jobData, defaultResume])

  const handleSaveApplication = useCallback(async () => {
    if (!jobData) return
    setIsLoading(true); setLoadingMsg('Saving…'); setError(null)
    try {
      const r = await fetch(`${API}/api/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_title: jobData.jobTitle,
          company: jobData.company,
          job_url: jobData.url,
          job_description: jobData.description,
          status: 'saved',
          resume_id: defaultResume?.id ?? null,
          cover_letter: coverLetter?.cover_letter ?? null,
          tailored_resume: tailoredResume?.tailored_resume ?? null,
          ats_score: tailoredResume?.ats_score ?? null,
          ats_details: tailoredResume?.ats_details ?? null,
        }),
        signal: AbortSignal.timeout(10_000),
      })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail ?? `Error ${r.status}`)
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save.')
    } finally { setIsLoading(false); setLoadingMsg('') }
  }, [jobData, defaultResume, coverLetter, tailoredResume])

  const handleSaveToResumes = useCallback(async (name: string) => {
    if (!tailoredResume) return
    const r = await fetch(`${API}/api/resumes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, content: tailoredResume.tailored_resume, is_default: false }),
    })
    if (!r.ok) throw new Error('Failed to save resume')
  }, [tailoredResume])

  // ── render ────────────────────────────────────────────────────────────────
  const tabs = [
    { id: 'job' as ActiveTab, label: 'Job', dot: false },
    { id: 'resume' as ActiveTab, label: 'Resume', dot: !!tailoredResume },
    { id: 'cover-letter' as ActiveTab, label: 'Cover Letter', dot: !!coverLetter },
  ]

  return (
    <div className="flex flex-col h-screen bg-[#0f172a] text-slate-100 overflow-hidden text-[13px]">

      {/* ── Header ── */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-[#1e293b] border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-sm font-bold shadow-lg">
            A
          </div>
          <span className="font-semibold tracking-tight">AI Job Assistant</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${backendOk ? 'bg-emerald-400' : 'bg-red-400'}`} />
          <span className={`text-[11px] ${backendOk ? 'text-emerald-400' : 'text-red-400'}`}>
            {backendOk ? 'Live' : 'Offline'}
          </span>
        </div>
      </header>

      {/* ── Loading bar ── */}
      {isLoading && (
        <div className="flex-shrink-0">
          <div className="h-0.5 bg-blue-500/30 overflow-hidden">
            <div className="h-full bg-blue-500 animate-[slide_1.5s_ease-in-out_infinite]" style={{ width: '40%' }} />
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-950/40 border-b border-blue-900/30">
            <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-[11px] text-blue-300">{loadingMsg}</span>
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="flex-shrink-0 flex items-start gap-2 px-4 py-2.5 bg-red-950/50 border-b border-red-900/40">
          <span className="text-red-400 text-xs mt-0.5">⚠</span>
          <span className="text-[11px] text-red-300 flex-1 leading-relaxed">{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-300 ml-1 text-xs">✕</button>
        </div>
      )}

      {/* ── Main ── */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {!jobData ? (
          <EmptyState backendOk={backendOk} />
        ) : (
          <>
            {/* Tab bar */}
            <div className="flex-shrink-0 flex bg-[#1e293b] border-b border-white/5">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium transition-colors relative ${
                    activeTab === t.id ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {t.label}
                  {t.dot && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                  {activeTab === t.id && (
                    <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-blue-500 rounded-t-full" />
                  )}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {activeTab === 'job' && (
                <JobInfo
                  jobData={jobData}
                  defaultResume={defaultResume}
                  onTailorResume={handleTailorResume}
                  onCoverLetter={handleCoverLetter}
                  onSaveApplication={handleSaveApplication}
                  isLoading={isLoading}
                  saved={saved}
                  backendOk={backendOk}
                />
              )}
              {activeTab === 'resume' && (
                <ResumeSection
                  result={tailoredResume}
                  jobData={jobData}
                  resumeId={defaultResume?.id ?? null}
                  onRetailor={handleTailorResume}
                  onSaveToResumes={handleSaveToResumes}
                  isLoading={isLoading}
                />
              )}
              {activeTab === 'cover-letter' && (
                <CoverLetterSection
                  result={coverLetter}
                  onGenerate={handleCoverLetter}
                  isLoading={isLoading}
                />
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Footer ── */}
      <footer className="flex-shrink-0 border-t border-white/5 bg-[#1e293b] px-4 py-2.5 flex items-center justify-between">
        <span className="text-[10px] text-slate-600">v0.1.0</span>
        <button
          onClick={() => chrome.tabs.create({ url: 'http://localhost:8000' })}
          className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
        >
          Dashboard ↗
        </button>
      </footer>
    </div>
  )
}

function EmptyState({ backendOk }: { backendOk: boolean }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-5 text-center gap-4">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-violet-600/20 border border-white/10 flex items-center justify-center text-2xl">
        🔍
      </div>
      <div>
        <p className="font-semibold text-slate-200 mb-1">No job detected</p>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Open a job posting on any supported site and the details will appear here automatically.
        </p>
      </div>
      <div className="w-full bg-[#1e293b] rounded-xl p-3 border border-white/5 text-left">
        <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-2">Supported</p>
        <div className="flex flex-wrap gap-1.5">
          {['LinkedIn', 'Indeed', 'Glassdoor', 'ZipRecruiter', 'Monster'].map((s) => (
            <span key={s} className="text-[11px] px-2.5 py-1 bg-white/5 text-slate-400 rounded-full border border-white/8">
              {s}
            </span>
          ))}
        </div>
      </div>
      {!backendOk && (
        <div className="w-full bg-amber-950/40 border border-amber-900/40 rounded-xl p-3 text-left">
          <p className="text-[11px] font-semibold text-amber-400 mb-0.5">Backend offline</p>
          <p className="text-[11px] text-amber-600/80">Run <code className="bg-black/30 px-1 rounded">./start.sh</code> to start the server.</p>
        </div>
      )}
    </div>
  )
}
