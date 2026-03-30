import { useEffect, useState } from 'react'
import {
  Save, Zap, CheckCircle, AlertCircle, Loader2,
  Server, Key, Cpu, Globe, Info, ExternalLink, User
} from 'lucide-react'
import { getSettings, updateSettings, getAIHealth } from '../api'
import type { Settings } from '../types'

const AUTOFILL_API = 'http://localhost:8000/api/autofill/profile'

interface AutofillProfile {
  full_name?: string
  email?: string
  phone?: string
  location?: string
  linkedin_url?: string
  portfolio_url?: string
  github_url?: string
  years_experience?: number | string
  current_title?: string
  current_company?: string
  willing_to_relocate?: boolean
  work_authorization?: string
  desired_salary?: string
  notice_period?: string
}

const EMPTY_AUTOFILL: AutofillProfile = {
  full_name: '',
  email: '',
  phone: '',
  location: '',
  linkedin_url: '',
  portfolio_url: '',
  github_url: '',
  years_experience: '',
  current_title: '',
  current_company: '',
  willing_to_relocate: false,
  work_authorization: '',
  desired_salary: '',
  notice_period: '',
}

const DEFAULT_SETTINGS: Settings = {
  provider: 'ollama',
  ollama_url: 'http://localhost:11434',
  ollama_model: 'llama3.2',
  anthropic_model: 'claude-3-5-haiku-20241022',
  anthropic_api_key: '',
}

type TestStatus = 'idle' | 'testing' | 'success' | 'failure'

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [testStatus, setTestStatus] = useState<TestStatus>('idle')
  const [testMessage, setTestMessage] = useState('')
  const [loadError, setLoadError] = useState('')

  // Autofill profile state
  const [autofill, setAutofill] = useState<AutofillProfile>(EMPTY_AUTOFILL)
  const [autofillSaving, setAutofillSaving] = useState(false)
  const [autofillStatus, setAutofillStatus] = useState<'idle' | 'saved' | 'error'>('idle')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setLoadError('')
      try {
        const data = await getSettings()
        setSettings({ ...DEFAULT_SETTINGS, ...data })
      } catch {
        setLoadError('Failed to load settings. Is the backend running?')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Load autofill profile on mount
  useEffect(() => {
    const loadAutofill = async () => {
      try {
        const res = await fetch(AUTOFILL_API)
        if (!res.ok) return
        const data: AutofillProfile = await res.json()
        setAutofill({ ...EMPTY_AUTOFILL, ...data })
      } catch {
        // backend may be offline; ignore silently
      }
    }
    loadAutofill()
  }, [])

  const handleSaveAutofill = async () => {
    setAutofillSaving(true)
    setAutofillStatus('idle')
    try {
      const payload = {
        ...autofill,
        years_experience: autofill.years_experience !== '' && autofill.years_experience !== undefined
          ? Number(autofill.years_experience)
          : null,
      }
      const res = await fetch(AUTOFILL_API, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Save failed')
      setAutofillStatus('saved')
      setTimeout(() => setAutofillStatus('idle'), 3000)
    } catch {
      setAutofillStatus('error')
    } finally {
      setAutofillSaving(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveStatus('idle')
    try {
      await updateSettings(settings)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 3000)
    } catch {
      setSaveStatus('error')
    } finally {
      setSaving(false)
    }
  }

  const handleTestConnection = async () => {
    // Save current settings first so the backend tests the right key/config
    setSaving(true)
    try {
      await updateSettings(settings)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 3000)
    } catch {
      setSaveStatus('error')
      setSaving(false)
      setTestStatus('failure')
      setTestMessage('Could not save settings before testing.')
      return
    }
    setSaving(false)

    setTestStatus('testing')
    setTestMessage('')
    try {
      const data = await getAIHealth()
      if (data && data.ok === true) {
        const models = data.models?.length ? ` — models: ${data.models.slice(0, 3).join(', ')}` : ''
        setTestStatus('success')
        setTestMessage(`Connected to ${data.provider}${models}`)
      } else {
        setTestStatus('failure')
        setTestMessage(data?.error ?? 'Connection failed. Check your configuration.')
      }
    } catch {
      setTestStatus('failure')
      setTestMessage('Could not reach the backend. Is the server running?')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-32">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {loadError}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Configure your AI provider and application preferences</p>
      </div>

      {/* AI Provider Section */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Cpu className="w-5 h-5 text-slate-600" />
          <h2 className="text-base font-semibold text-slate-800">AI Provider</h2>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Choose your AI provider. Ollama runs locally and is free; Anthropic uses the Claude API.
        </p>

        {/* Provider Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {/* Ollama Card */}
          <button
            type="button"
            onClick={() => setSettings(s => ({ ...s, provider: 'ollama' }))}
            className={`text-left p-4 rounded-xl border-2 transition-all duration-200 ${
              settings.provider === 'ollama'
                ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center">
                  <Server className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Ollama</p>
                  <p className="text-xs text-emerald-600 font-medium">Local · Free</p>
                </div>
              </div>
              <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex items-center justify-center ${
                settings.provider === 'ollama' ? 'border-blue-500' : 'border-slate-300'
              }`}>
                {settings.provider === 'ollama' && (
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                )}
              </div>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Run open-source models locally. No API key required, full privacy.
            </p>
          </button>

          {/* Anthropic Card */}
          <button
            type="button"
            onClick={() => setSettings(s => ({ ...s, provider: 'anthropic' }))}
            className={`text-left p-4 rounded-xl border-2 transition-all duration-200 ${
              settings.provider === 'anthropic'
                ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Anthropic</p>
                  <p className="text-xs text-orange-600 font-medium">Claude API</p>
                </div>
              </div>
              <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex items-center justify-center ${
                settings.provider === 'anthropic' ? 'border-blue-500' : 'border-slate-300'
              }`}>
                {settings.provider === 'anthropic' && (
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                )}
              </div>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Use Claude AI via the Anthropic API. Best quality, requires API key.
            </p>
          </button>
        </div>

        {/* Provider-specific fields */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          {settings.provider === 'ollama' ? (
            <>
              <div>
                <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1.5">
                  <Globe className="w-3.5 h-3.5 text-slate-500" />
                  Ollama URL
                </label>
                <input
                  type="url"
                  value={settings.ollama_url}
                  onChange={e => setSettings(s => ({ ...s, ollama_url: e.target.value }))}
                  placeholder="http://localhost:11434"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                />
                <p className="text-xs text-slate-400 mt-1">The URL where your Ollama server is running.</p>
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1.5">
                  <Cpu className="w-3.5 h-3.5 text-slate-500" />
                  Model Name
                </label>
                <input
                  type="text"
                  value={settings.ollama_model}
                  onChange={e => setSettings(s => ({ ...s, ollama_model: e.target.value }))}
                  placeholder="e.g. llama3.2, mistral, phi3"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Must be pulled with <code className="bg-slate-100 px-1 rounded text-xs">ollama pull &lt;model&gt;</code>
                </p>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1.5">
                  <Key className="w-3.5 h-3.5 text-slate-500" />
                  API Key
                </label>
                <input
                  type="password"
                  value={settings.anthropic_api_key}
                  onChange={e => setSettings(s => ({ ...s, anthropic_api_key: e.target.value }))}
                  placeholder="sk-ant-..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Get your key from{' '}
                  <a
                    href="https://console.anthropic.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-700 inline-flex items-center gap-0.5"
                  >
                    console.anthropic.com <ExternalLink className="w-3 h-3" />
                  </a>
                </p>
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1.5">
                  <Cpu className="w-3.5 h-3.5 text-slate-500" />
                  Model
                </label>
                <select
                  value={settings.anthropic_model}
                  onChange={e => setSettings(s => ({ ...s, anthropic_model: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white font-mono"
                >
                  <option value="claude-3-5-haiku-20241022">claude-3-5-haiku-20241022 (Fast)</option>
                  <option value="claude-3-5-sonnet-20241022">claude-3-5-sonnet-20241022 (Balanced)</option>
                  <option value="claude-opus-4-5">claude-opus-4-5 (Most capable)</option>
                </select>
                <p className="text-xs text-slate-400 mt-1">Choose the Claude model that fits your needs and budget.</p>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Test Connection + Save */}
      <section className="mb-8">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleTestConnection}
            disabled={testStatus === 'testing'}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-60 rounded-lg transition-colors shadow-sm"
          >
            {testStatus === 'testing'
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Zap className="w-4 h-4" />}
            {testStatus === 'testing' ? 'Testing...' : 'Test Connection'}
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition-colors shadow-sm"
          >
            {saving
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

        {/* Test result */}
        {testStatus === 'success' && (
          <div className="flex items-start gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 mt-3">
            <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{testMessage}</span>
          </div>
        )}
        {testStatus === 'failure' && (
          <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mt-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{testMessage}</span>
          </div>
        )}

        {/* Save result */}
        {saveStatus === 'saved' && (
          <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 mt-3">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            Settings saved successfully.
          </div>
        )}
        {saveStatus === 'error' && (
          <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mt-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Failed to save settings. Please try again.
          </div>
        )}
      </section>

      {/* Autofill Profile Section */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-5 h-5 text-slate-600" />
          <h2 className="text-base font-semibold text-slate-800">Autofill Profile</h2>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Save your details once and let the extension auto-fill job application forms on any company career portal.
        </p>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          {/* Row: full name + email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
              <input
                type="text"
                value={autofill.full_name ?? ''}
                onChange={e => setAutofill(a => ({ ...a, full_name: e.target.value }))}
                placeholder="Jane Smith"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input
                type="email"
                value={autofill.email ?? ''}
                onChange={e => setAutofill(a => ({ ...a, email: e.target.value }))}
                placeholder="jane@example.com"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Row: phone + location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone</label>
              <input
                type="tel"
                value={autofill.phone ?? ''}
                onChange={e => setAutofill(a => ({ ...a, phone: e.target.value }))}
                placeholder="+1 555 000 0000"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Location</label>
              <input
                type="text"
                value={autofill.location ?? ''}
                onChange={e => setAutofill(a => ({ ...a, location: e.target.value }))}
                placeholder="San Francisco, CA"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Row: current title + current company */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Current Title</label>
              <input
                type="text"
                value={autofill.current_title ?? ''}
                onChange={e => setAutofill(a => ({ ...a, current_title: e.target.value }))}
                placeholder="Senior Software Engineer"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Current Company</label>
              <input
                type="text"
                value={autofill.current_company ?? ''}
                onChange={e => setAutofill(a => ({ ...a, current_company: e.target.value }))}
                placeholder="Acme Corp"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Row: years experience + work authorization */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Years of Experience</label>
              <input
                type="number"
                min={0}
                max={60}
                value={autofill.years_experience ?? ''}
                onChange={e => setAutofill(a => ({ ...a, years_experience: e.target.value }))}
                placeholder="5"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Work Authorization</label>
              <input
                type="text"
                value={autofill.work_authorization ?? ''}
                onChange={e => setAutofill(a => ({ ...a, work_authorization: e.target.value }))}
                placeholder="US Citizen, H1B, Green Card…"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Row: desired salary + notice period */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Desired Salary</label>
              <input
                type="text"
                value={autofill.desired_salary ?? ''}
                onChange={e => setAutofill(a => ({ ...a, desired_salary: e.target.value }))}
                placeholder="$120,000"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Notice Period / Availability</label>
              <input
                type="text"
                value={autofill.notice_period ?? ''}
                onChange={e => setAutofill(a => ({ ...a, notice_period: e.target.value }))}
                placeholder="2 weeks, Immediately…"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* URLs */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">LinkedIn URL</label>
            <input
              type="url"
              value={autofill.linkedin_url ?? ''}
              onChange={e => setAutofill(a => ({ ...a, linkedin_url: e.target.value }))}
              placeholder="https://linkedin.com/in/janesmith"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Portfolio / Website</label>
              <input
                type="url"
                value={autofill.portfolio_url ?? ''}
                onChange={e => setAutofill(a => ({ ...a, portfolio_url: e.target.value }))}
                placeholder="https://janesmith.dev"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">GitHub URL</label>
              <input
                type="url"
                value={autofill.github_url ?? ''}
                onChange={e => setAutofill(a => ({ ...a, github_url: e.target.value }))}
                placeholder="https://github.com/janesmith"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
              />
            </div>
          </div>

          {/* Willing to relocate */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="willing_to_relocate"
              checked={autofill.willing_to_relocate ?? false}
              onChange={e => setAutofill(a => ({ ...a, willing_to_relocate: e.target.checked }))}
              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="willing_to_relocate" className="text-sm font-medium text-slate-700 select-none cursor-pointer">
              Willing to relocate
            </label>
          </div>
        </div>

        {/* Save autofill profile */}
        <div className="flex items-center gap-3 flex-wrap mt-4">
          <button
            onClick={handleSaveAutofill}
            disabled={autofillSaving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition-colors shadow-sm"
          >
            {autofillSaving
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Save className="w-4 h-4" />}
            {autofillSaving ? 'Saving…' : 'Save Autofill Profile'}
          </button>
        </div>

        {autofillStatus === 'saved' && (
          <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 mt-3">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            Autofill profile saved successfully.
          </div>
        )}
        {autofillStatus === 'error' && (
          <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mt-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Failed to save autofill profile. Please try again.
          </div>
        )}
      </section>

      {/* About Section */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Info className="w-5 h-5 text-slate-600" />
          <h2 className="text-base font-semibold text-slate-800">About</h2>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">AI Job Assistant</h3>
              <p className="text-xs text-slate-500">Version 0.1.0</p>
            </div>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed mb-3">
            AI Job Assistant helps you manage your job search with the power of AI. It can tailor your resume to specific
            job descriptions, generate cover letters, analyze ATS compatibility, and track all your applications in one place.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FeaturePill icon={<Cpu className="w-3.5 h-3.5" />} label="AI Resume Tailoring" />
            <FeaturePill icon={<CheckCircle className="w-3.5 h-3.5" />} label="ATS Score Analysis" />
            <FeaturePill icon={<Key className="w-3.5 h-3.5" />} label="Cover Letter Generation" />
          </div>
        </div>
      </section>
    </div>
  )
}

function FeaturePill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
      <span className="text-blue-500">{icon}</span>
      <span className="text-xs font-medium text-slate-600">{label}</span>
    </div>
  )
}
