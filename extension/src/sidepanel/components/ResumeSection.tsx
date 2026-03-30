import React, { useState } from 'react'
import type { TailoredResumeResult, JobData } from '../App'
import ATSScore from './ATSScore'

interface Props {
  result: TailoredResumeResult | null
  jobData: JobData | null
  resumeId: number | null
  onRetailor: () => void
  onSaveToResumes: (name: string) => Promise<void>
  isLoading: boolean
}

export default function ResumeSection({ result, jobData, resumeId, onRetailor, onSaveToResumes, isLoading }: Props) {
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedName, setSavedName] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const copy = async () => {
    if (!result) return
    try { await navigator.clipboard.writeText(result.tailored_resume) }
    catch { /* fallback */ const t = document.createElement('textarea'); t.value = result.tailored_resume; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t) }
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const [downloading, setDownloading] = useState(false)

  const download = async () => {
    if (!result) return
    const company = jobData?.company?.replace(/\s+/g, '_') ?? 'Company'
    const title = jobData?.jobTitle?.replace(/\s+/g, '_') ?? 'Role'
    const filename = `${company}_${title}_Resume`
    setDownloading(true)
    try {
      // Prefer in-place edit of original PDF when we have the resume ID
      const url = resumeId
        ? `http://localhost:8000/api/resumes/${resumeId}/tailored-pdf`
        : 'http://localhost:8000/api/resumes/download-pdf'
      const body = resumeId
        ? JSON.stringify({ tailored_text: result.tailored_resume, filename })
        : JSON.stringify({ text: result.tailored_resume, filename })
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
      if (!resp.ok) throw new Error('PDF generation failed')
      const blob = await resp.blob()
      const objUrl = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = objUrl; a.download = `${filename}.pdf`; a.click()
      URL.revokeObjectURL(objUrl)
    } catch {
      const blob = new Blob([result.tailored_resume], { type: 'text/plain' })
      const objUrl = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = objUrl; a.download = `${filename}.txt`; a.click()
      URL.revokeObjectURL(objUrl)
    } finally {
      setDownloading(false)
    }
  }

  const saveToResumes = async () => {
    if (!result || !jobData) return
    setSaving(true); setSaveError(null)
    const name = `${jobData.company} – ${jobData.jobTitle} (tailored)`
    try {
      await onSaveToResumes(name)
      setSavedName(name)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save')
    } finally { setSaving(false) }
  }

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] px-5 text-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-[#1e293b] border border-white/5 flex items-center justify-center text-2xl">
          📄
        </div>
        <div>
          <p className="font-semibold text-slate-200 mb-1">No tailored resume yet</p>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Go to the Job tab and click "Tailor Resume" to generate a version optimised for this role.
          </p>
        </div>
        <button
          onClick={onRetailor}
          disabled={isLoading}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-[12px] font-semibold rounded-xl transition-colors"
        >
          {isLoading ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : '✏️'}
          Tailor Resume
        </button>
      </div>
    )
  }

  return (
    <div className="p-3 space-y-2.5">

      {/* ATS Score */}
      <ATSScore atsDetails={result.ats_details} />

      {/* Resume card */}
      <div className="bg-[#1e293b] rounded-2xl border border-white/5 overflow-hidden">

        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
          <span className="text-[11px] font-semibold text-slate-300">Tailored Resume</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={copy}
              className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
                copied
                  ? 'bg-emerald-950/50 border-emerald-800/50 text-emerald-400'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
              }`}
            >
              {copied ? '✓ Copied' : '⎘ Copy'}
            </button>
            <button
              onClick={download}
              disabled={downloading}
              className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg border bg-white/5 border-white/10 text-slate-400 hover:text-slate-200 disabled:opacity-50 transition-colors"
            >
              {downloading ? <span className="w-3 h-3 border border-slate-400/30 border-t-slate-400 rounded-full animate-spin inline-block" /> : '↓'} PDF
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 max-h-72 overflow-y-auto">
          <pre className="text-[11px] text-slate-300 whitespace-pre-wrap break-words font-mono leading-relaxed">
            {result.tailored_resume}
          </pre>
        </div>
      </div>

      {/* Save to Resumes */}
      <div className="bg-[#1e293b] rounded-2xl border border-white/5 p-3 space-y-2">
        <p className="text-[11px] font-medium text-slate-400">Save this version to your resume library</p>
        {savedName ? (
          <div className="flex items-center gap-2 text-[11px] text-emerald-400">
            <span>✓</span>
            <span>Saved as "<span className="font-medium">{savedName}</span>"</span>
          </div>
        ) : saveError ? (
          <p className="text-[11px] text-red-400">{saveError}</p>
        ) : (
          <button
            onClick={saveToResumes}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-2 bg-white/5 hover:bg-white/8 disabled:opacity-40 text-slate-300 text-[11px] font-medium rounded-xl border border-white/10 transition-colors"
          >
            {saving ? (
              <><div className="w-3 h-3 border-2 border-slate-400/30 border-t-slate-400 rounded-full animate-spin" /> Saving…</>
            ) : (
              <>💾 Save to Resumes</>
            )}
          </button>
        )}
      </div>

      {/* Re-tailor */}
      <button
        onClick={onRetailor}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-transparent hover:bg-white/5 disabled:opacity-40 text-slate-500 hover:text-slate-300 text-[11px] rounded-2xl border border-white/8 transition-colors"
      >
        {isLoading
          ? <><div className="w-3 h-3 border-2 border-slate-500/30 border-t-slate-500 rounded-full animate-spin" /> Regenerating…</>
          : '↺ Re-tailor'
        }
      </button>
    </div>
  )
}
