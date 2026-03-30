import { useState, useEffect } from 'react'
import { listApplications } from '../api'
import type { Application } from '../types'

interface Question {
  id: number
  question: string
  question_type: 'behavioral' | 'technical' | 'situational'
  user_answer?: string | null
  ai_score?: number | null
  ai_feedback?: {
    score: number
    star_breakdown: { situation: string; task: string; action: string; result: string }
    strengths: string[]
    improvements: string[]
    overall_feedback: string
  } | null
}

const TYPE_COLORS: Record<string, string> = {
  behavioral: 'bg-blue-100 text-blue-700 border-blue-300',
  technical: 'bg-violet-100 text-violet-700 border-violet-300',
  situational: 'bg-amber-100 text-amber-700 border-amber-300',
}

function QuestionCard({
  q,
  onAnswerSaved,
}: {
  q: Question
  onAnswerSaved: (updated: Question) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [answer, setAnswer] = useState(q.user_answer || '')
  const [saving, setSaving] = useState(false)
  const [scoring, setScoring] = useState(false)

  const saveAnswer = async () => {
    if (!answer.trim()) return
    setSaving(true)
    try {
      await fetch(`/api/interview/questions/${q.id}/answer`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer }),
      })
      onAnswerSaved({ ...q, user_answer: answer })
    } finally {
      setSaving(false)
    }
  }

  const scoreAnswer = async () => {
    // Save first to ensure the latest text is persisted before scoring
    if (answer.trim() && answer !== q.user_answer) {
      await fetch(`/api/interview/questions/${q.id}/answer`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer }),
      })
    }
    setScoring(true)
    try {
      const r = await fetch(`/api/interview/questions/${q.id}/score`, { method: 'POST' })
      if (r.ok) {
        const feedback = await r.json()
        onAnswerSaved({
          ...q,
          user_answer: answer,
          ai_score: feedback.score,
          ai_feedback: feedback,
        })
      }
    } finally {
      setScoring(false)
    }
  }

  const score = q.ai_score
  const scoreColor =
    score == null
      ? ''
      : score >= 80
      ? 'text-emerald-600'
      : score >= 60
      ? 'text-amber-600'
      : 'text-red-600'

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-slate-50 transition-colors"
      >
        <span
          className={`text-xs px-2 py-0.5 rounded-full border shrink-0 mt-0.5 capitalize font-medium ${
            TYPE_COLORS[q.question_type] || TYPE_COLORS.behavioral
          }`}
        >
          {q.question_type}
        </span>
        <span className="text-sm text-slate-700 flex-1 leading-snug">{q.question}</span>
        {score != null && (
          <span className={`text-sm font-bold shrink-0 ${scoreColor}`}>{score}</span>
        )}
        <span className="text-slate-400 shrink-0">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-slate-200 pt-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Your Answer</label>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Structure your answer using STAR: Situation, Task, Action, Result..."
              rows={5}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={saveAnswer}
                disabled={saving || !answer.trim()}
                className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg text-slate-700 font-medium transition-colors"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={scoreAnswer}
                disabled={scoring || !answer.trim()}
                className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-white font-medium transition-colors"
              >
                {scoring ? 'Scoring...' : 'Score with AI'}
              </button>
            </div>
          </div>

          {q.ai_feedback && (
            <div className="space-y-3 border-t border-slate-200 pt-3">
              <div className="flex items-center gap-3">
                <span className={`text-2xl font-bold ${scoreColor}`}>{q.ai_score}</span>
                <div className="flex-1 h-2 bg-slate-200 rounded-full">
                  <div
                    className={`h-full rounded-full ${
                      (q.ai_score || 0) >= 80
                        ? 'bg-emerald-500'
                        : (q.ai_score || 0) >= 60
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${q.ai_score}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {Object.entries(q.ai_feedback.star_breakdown).map(([k, v]) => (
                  <div key={k} className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-0.5">{k}</p>
                    <p className="text-xs text-slate-700 leading-snug">{v}</p>
                  </div>
                ))}
              </div>

              {q.ai_feedback.strengths.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-emerald-700 mb-1">Strengths</p>
                  {q.ai_feedback.strengths.map((s, i) => (
                    <p key={i} className="text-xs text-slate-700">
                      • {s}
                    </p>
                  ))}
                </div>
              )}
              {q.ai_feedback.improvements.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-amber-700 mb-1">Improvements</p>
                  {q.ai_feedback.improvements.map((s, i) => (
                    <p key={i} className="text-xs text-slate-700">
                      • {s}
                    </p>
                  ))}
                </div>
              )}
              <p className="text-xs text-slate-600 italic">{q.ai_feedback.overall_feedback}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function InterviewPrep() {
  const [apps, setApps] = useState<Application[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [generating, setGenerating] = useState(false)
  const [activeTypes, setActiveTypes] = useState(['behavioral', 'technical', 'situational'])
  const [count, setCount] = useState(8)

  useEffect(() => {
    listApplications()
      .then(setApps)
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedId) return
    fetch(`/api/interview/${selectedId}/questions`)
      .then((r) => r.json())
      .then(setQuestions)
      .catch(() => {})
  }, [selectedId])

  const generate = async () => {
    if (!selectedId) return
    setGenerating(true)
    try {
      const r = await fetch(`/api/interview/${selectedId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ types: activeTypes, count }),
      })
      if (r.ok) {
        const newQs = await r.json()
        setQuestions((prev) => [...newQs, ...prev])
      }
    } finally {
      setGenerating(false)
    }
  }

  const updateQuestion = (updated: Question) => {
    setQuestions((prev) => prev.map((q) => (q.id === updated.id ? updated : q)))
  }

  const toggleType = (t: string) => {
    setActiveTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 px-6 py-5 border-b border-slate-200">
        <h1 className="text-xl font-semibold text-slate-800">Interview Prep</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          AI-generated questions + STAR scoring for your saved applications
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* Application picker */}
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={selectedId ?? ''}
            onChange={(e) => {
              setSelectedId(Number(e.target.value) || null)
              setQuestions([])
            }}
            className="flex-1 bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select an application...</option>
            {apps.map((a) => (
              <option key={a.id} value={a.id}>
                {a.job_title} — {a.company}
              </option>
            ))}
          </select>
        </div>

        {selectedId && (
          <>
            {/* Generate controls */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm">
              <p className="text-xs font-semibold text-slate-600">Question Types</p>
              <div className="flex flex-wrap gap-2">
                {(['behavioral', 'technical', 'situational'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => toggleType(t)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors capitalize font-medium ${
                      activeTypes.includes(t)
                        ? TYPE_COLORS[t]
                        : 'bg-white border-slate-300 text-slate-500 hover:border-slate-400'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs font-medium text-slate-600 shrink-0">Questions</label>
                <input
                  type="range"
                  min={3}
                  max={15}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className="flex-1 accent-blue-500"
                />
                <span className="text-xs font-semibold text-slate-700 w-4">{count}</span>
              </div>
              <button
                onClick={generate}
                disabled={generating || activeTypes.length === 0}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors"
              >
                {generating ? 'Generating...' : 'Generate Questions'}
              </button>
            </div>

            {/* Questions list */}
            {questions.length > 0 ? (
              <div className="space-y-3">
                <p className="text-xs font-medium text-slate-500">{questions.length} questions</p>
                {questions.map((q) => (
                  <QuestionCard key={q.id} q={q} onAnswerSaved={updateQuestion} />
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-slate-500 text-sm">
                No questions yet — click Generate to create role-specific questions from the JD
              </div>
            )}
          </>
        )}

        {!selectedId && (
          <div className="text-center py-16 text-slate-500 text-sm">
            Select an application above to start interview prep
          </div>
        )}
      </div>
    </div>
  )
}
