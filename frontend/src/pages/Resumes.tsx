import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Plus, Trash2, Edit2, Eye, Star, FileText,
  AlertCircle, Loader2, X, Calendar, CheckCircle,
  Upload, Download
} from 'lucide-react'
import { listResumes, createResume, updateResume, deleteResume, getResume } from '../api'
import type { Resume } from '../types'

const BASE = '/api'

function ModalOverlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      {children}
    </div>
  )
}

interface ResumeForm { name: string; content: string; is_default: boolean }
const DEFAULT_FORM: ResumeForm = { name: '', content: '', is_default: false }

function ResumeFormModal({
  initial, title, onClose, onSaved,
}: {
  initial?: Resume & { content?: string }
  title: string
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<ResumeForm>(
    initial ? { name: initial.name, content: initial.content ?? '', is_default: !!initial.is_default } : DEFAULT_FORM
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [parsing, setParsing] = useState(false)
  const [enhancing, setEnhancing] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [pdfB64, setPdfB64] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const parsePdf = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) { setError('Only PDF files are supported.'); return }
    setParsing(true); setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await fetch(`${BASE}/resumes/parse-pdf`, { method: 'POST', body: fd })
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.detail ?? 'Failed to parse PDF') }
      const { text, pdf_b64 } = await r.json()
      // Auto-fill name from filename if empty
      const nameFromFile = file.name.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ')
      setPdfB64(pdf_b64 ?? null)
      setForm(f => ({ ...f, content: text, name: f.name || nameFromFile }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse PDF')
    } finally { setParsing(false) }
  }

  const aiEnhance = async () => {
    if (!form.content.trim()) return
    setEnhancing(true); setError('')
    try {
      const r = await fetch(`${BASE}/resumes/ai-parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: form.content }),
      })
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.detail ?? 'AI enhancement failed') }
      const { text } = await r.json()
      setForm(f => ({ ...f, content: text }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI enhancement failed')
    } finally { setEnhancing(false) }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) parsePdf(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Resume name is required.'); return }
    if (!form.content.trim()) { setError('Resume content is required.'); return }
    setSaving(true); setError('')
    try {
      if (initial) {
        await updateResume(initial.id, { name: form.name.trim(), content: form.content.trim(), is_default: form.is_default })
      } else {
        await createResume({ name: form.name.trim(), content: form.content.trim(), is_default: form.is_default, pdf_b64: pdfB64 ?? undefined })
      }
      onSaved()
    } catch { setError('Failed to save resume. Please try again.'); setSaving(false) }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
              </div>
            )}

            {/* PDF upload zone — only shown when content is empty */}
            {!form.content && (
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors ${
                  dragOver ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                }`}
              >
                <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) parsePdf(f) }} />
                {parsing ? (
                  <><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /><p className="text-sm font-medium text-blue-600">Extracting text from PDF…</p></>
                ) : (
                  <>
                    <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
                      <Upload className="w-6 h-6 text-blue-500" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-slate-700">Drop your PDF resume here</p>
                      <p className="text-xs text-slate-400 mt-0.5">or click to browse · PDF only · max 10 MB</p>
                    </div>
                    <p className="text-xs text-slate-400 italic">The text will be extracted and editable before saving</p>
                  </>
                )}
              </div>
            )}

            {/* If content is filled show the re-upload + AI enhance buttons */}
            {form.content && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={parsing || enhancing}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 transition-colors"
                >
                  {parsing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {parsing ? 'Parsing…' : 'Re-upload PDF'}
                </button>
                <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) parsePdf(f) }} />
                <button
                  type="button"
                  onClick={aiEnhance}
                  disabled={enhancing || parsing}
                  className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-800 font-medium transition-colors"
                >
                  {enhancing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span>✨</span>}
                  {enhancing ? 'AI cleaning up…' : 'AI Clean Up'}
                </button>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Resume Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Software Engineer Resume v2"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Resume Content <span className="text-red-500">*</span>
                <span className="ml-2 text-xs font-normal text-slate-400">— edit freely after PDF import</span>
              </label>
              <textarea
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                rows={18}
                placeholder="Paste your resume content here, or drop a PDF above to auto-fill…"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono"
              />
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-slate-700">Set as default resume</span>
            </label>
          </div>

          <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 flex-shrink-0">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition-colors">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Saving…' : (initial ? 'Save Changes' : 'Add Resume')}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  )
}

function ViewResumeModal({ resume, onClose, onEdit }: { resume: Resume & { content?: string }; onClose: () => void; onEdit: () => void }) {
  const [downloading, setDownloading] = useState(false)

  const downloadPdf = async () => {
    setDownloading(true)
    try {
      const r = await fetch(`${BASE}/resumes/${resume.id}/pdf`)
      if (!r.ok) throw new Error('Failed')
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `${resume.name.replace(/\s+/g, '_')}.pdf`; a.click()
      URL.revokeObjectURL(url)
    } catch { alert('Failed to download PDF') }
    finally { setDownloading(false) }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-semibold text-slate-800">{resume.name}</h2>
            {!!resume.is_default && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-full">
                <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />Default
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={downloadPdf}
              disabled={downloading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors disabled:opacity-60"
            >
              {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Download PDF
            </button>
            <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
              <Edit2 className="w-3.5 h-3.5" />Edit
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X className="w-5 h-5" /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {resume.content
            ? <pre className="text-sm text-slate-700 whitespace-pre-wrap font-mono leading-relaxed">{resume.content}</pre>
            : <p className="text-sm text-slate-400 italic">No content available.</p>}
        </div>
      </div>
    </ModalOverlay>
  )
}

function ResumeCard({ resume, onView, onEdit, onSetDefault, onDelete }: {
  resume: Resume; onView: (r: Resume) => void; onEdit: (r: Resume) => void
  onSetDefault: (id: number) => void; onDelete: (id: number) => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [settingDefault, setSettingDefault] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const isDefault = !!resume.is_default
  const preview = resume.preview ?? resume.content?.slice(0, 200)

  const downloadPdf = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setDownloading(true)
    try {
      const r = await fetch(`${BASE}/resumes/${resume.id}/pdf`)
      if (!r.ok) throw new Error('Failed')
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `${resume.name.replace(/\s+/g, '_')}.pdf`; a.click()
      URL.revokeObjectURL(url)
    } catch { alert('Failed to download PDF') }
    finally { setDownloading(false) }
  }

  return (
    <div className={`bg-white border rounded-xl p-5 hover:shadow-md transition-shadow duration-200 flex flex-col gap-3 ${isDefault ? 'border-yellow-300 ring-1 ring-yellow-200' : 'border-slate-200'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <FileText className="w-4 h-4 text-blue-600" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-800 text-sm leading-tight truncate">{resume.name}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Calendar className="w-3 h-3 text-slate-400" />
              <span className="text-xs text-slate-400">{new Date(resume.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
        {isDefault && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-full flex-shrink-0">
            <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />Default
          </span>
        )}
      </div>

      {preview && (
        <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed font-mono bg-slate-50 border border-slate-100 rounded-lg p-2.5">
          {preview}{(preview.length >= 200) && '…'}
        </p>
      )}

      <div className="flex items-center gap-2 pt-1 border-t border-slate-100 mt-auto flex-wrap">
        <button onClick={() => onView(resume)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
          <Eye className="w-3.5 h-3.5" />View
        </button>
        <button onClick={() => onEdit(resume)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
          <Edit2 className="w-3.5 h-3.5" />Edit
        </button>
        <button onClick={downloadPdf} disabled={downloading} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors disabled:opacity-60">
          {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          PDF
        </button>
        {!isDefault && (
          <button onClick={async () => { setSettingDefault(true); try { await onSetDefault(resume.id) } finally { setSettingDefault(false) } }} disabled={settingDefault} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-yellow-700 bg-yellow-50 hover:bg-yellow-100 rounded-lg transition-colors disabled:opacity-60">
            {settingDefault ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Star className="w-3.5 h-3.5" />}
            Default
          </button>
        )}
        <button onClick={() => { if (!confirm(`Delete "${resume.name}"?`)) return; setDeleting(true); onDelete(resume.id) }} disabled={deleting} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50">
          {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}Delete
        </button>
      </div>
    </div>
  )
}

export default function Resumes() {
  const [resumes, setResumes] = useState<Resume[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingResume, setEditingResume] = useState<(Resume & { content?: string }) | null>(null)
  const [viewingResume, setViewingResume] = useState<(Resume & { content?: string }) | null>(null)
  const [successMsg, setSuccessMsg] = useState('')

  const fetchResumes = useCallback(async () => {
    setLoading(true); setError('')
    try { const data = await listResumes(); setResumes(Array.isArray(data) ? data : []) }
    catch { setError('Failed to load resumes. Is the backend running?') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchResumes() }, [fetchResumes])

  const showSuccess = (msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 3000) }

  const handleView = async (resume: Resume) => {
    try { setViewingResume(await getResume(resume.id)) } catch { setViewingResume(resume) }
  }
  const handleEdit = async (resume: Resume) => {
    try { setEditingResume(await getResume(resume.id)) } catch { setEditingResume(resume) }
  }
  const handleSetDefault = async (id: number) => {
    try { await updateResume(id, { is_default: true }); setResumes(prev => prev.map(r => ({ ...r, is_default: r.id === id ? 1 : 0 }))); showSuccess('Default resume updated.') }
    catch { alert('Failed to set default.') }
  }
  const handleDelete = async (id: number) => {
    try { await deleteResume(id); setResumes(prev => prev.filter(r => r.id !== id)); showSuccess('Resume deleted.') }
    catch { alert('Failed to delete.') }
  }
  const handleSaved = () => { setShowAddModal(false); setEditingResume(null); fetchResumes(); showSuccess('Resume saved.') }

  return (
    <div className="p-6 min-h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My Resumes</h1>
          <p className="text-sm text-slate-500 mt-0.5">Upload a PDF or paste text — edit freely, download as PDF</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm">
          <Plus className="w-4 h-4" />Add Resume
        </button>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 mb-4">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />{successMsg}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
      ) : resumes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-slate-700 mb-1">No resumes yet</h3>
          <p className="text-sm text-slate-500 mb-4 max-w-sm">Upload a PDF or paste plain text. The AI will tailor it for each job.</p>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
            <Plus className="w-4 h-4" />Add Resume
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {resumes.map(resume => (
            <ResumeCard key={resume.id} resume={resume} onView={handleView} onEdit={handleEdit} onSetDefault={handleSetDefault} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {showAddModal && <ResumeFormModal title="Add Resume" onClose={() => setShowAddModal(false)} onSaved={handleSaved} />}
      {editingResume && <ResumeFormModal title="Edit Resume" initial={editingResume} onClose={() => setEditingResume(null)} onSaved={handleSaved} />}
      {viewingResume && !editingResume && (
        <ViewResumeModal
          resume={viewingResume}
          onClose={() => setViewingResume(null)}
          onEdit={() => { setEditingResume(viewingResume); setViewingResume(null) }}
        />
      )}
    </div>
  )
}
