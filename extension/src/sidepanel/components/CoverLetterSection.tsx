import React, { useState } from 'react'
import type { CoverLetterResult, JobData } from '../App'

interface Props {
  result: CoverLetterResult | null
  onGenerate: () => void
  isLoading: boolean
  jobData?: JobData | null
}

export default function CoverLetterSection({ result, onGenerate, isLoading, jobData }: Props) {
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const copy = async () => {
    if (!result) return
    try { await navigator.clipboard.writeText(result.cover_letter) }
    catch { const t = document.createElement('textarea'); t.value = result.cover_letter; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t) }
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const download = async () => {
    if (!result) return
    const company = jobData?.company?.replace(/\s+/g, '_') ?? 'Company'
    const title = jobData?.jobTitle?.replace(/\s+/g, '_') ?? 'Role'
    const filename = `${company}_${title}_CoverLetter`
    setDownloading(true)
    try {
      const resp = await fetch('http://localhost:8000/api/resumes/download-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: result.cover_letter, filename }),
      })
      if (!resp.ok) throw new Error('PDF generation failed')
      const blob = await resp.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `${filename}.pdf`; a.click()
      URL.revokeObjectURL(url)
    } catch {
      const blob = new Blob([result.cover_letter], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `${filename}.txt`; a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(false)
    }
  }

  const wordCount = result?.cover_letter.split(/\s+/).filter(Boolean).length ?? 0

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[300px] px-5 text-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-[#1e293b] border border-white/5 flex items-center justify-center text-2xl">
          📝
        </div>
        <div>
          <p className="font-semibold text-slate-200 mb-1">No cover letter yet</p>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Go to the Job tab and click "Cover Letter" to generate a personalised draft.
          </p>
        </div>
        <button
          onClick={onGenerate}
          disabled={isLoading}
          className="flex items-center gap-2 px-5 py-2.5 bg-violet-600/80 hover:bg-violet-600 disabled:opacity-40 text-white text-[12px] font-semibold rounded-xl transition-colors"
        >
          {isLoading ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : '📝'}
          Generate Cover Letter
        </button>
      </div>
    )
  }

  return (
    <div className="p-3 space-y-2.5">

      {/* Cover letter card */}
      <div className="bg-[#1e293b] rounded-2xl border border-white/5 overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-300">Cover Letter</span>
            <span className="text-[10px] text-slate-600">{wordCount} words</span>
          </div>
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
        <div className="p-4 max-h-96 overflow-y-auto">
          <div className="text-[12px] text-slate-300 leading-[1.7] whitespace-pre-wrap break-words">
            {result.cover_letter}
          </div>
        </div>
      </div>

      {/* Regenerate */}
      <button
        onClick={onGenerate}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-transparent hover:bg-white/5 disabled:opacity-40 text-slate-500 hover:text-slate-300 text-[11px] rounded-2xl border border-white/8 transition-colors"
      >
        {isLoading
          ? <><div className="w-3 h-3 border-2 border-slate-500/30 border-t-slate-500 rounded-full animate-spin" /> Regenerating…</>
          : '↺ Regenerate'
        }
      </button>
    </div>
  )
}
