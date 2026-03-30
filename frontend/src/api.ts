import type { Settings, Resume, Application } from './types'

const BASE = '/api'

async function handleResponse<T>(r: Response): Promise<T> {
  if (!r.ok) {
    const body = await r.json().catch(() => ({}))
    throw new Error((body as { detail?: string; error?: string }).detail ?? (body as { detail?: string; error?: string }).error ?? `Request failed (${r.status})`)
  }
  return r.json() as Promise<T>
}

// Settings
export const getSettings = (): Promise<Settings> =>
  fetch(`${BASE}/settings`).then(r => handleResponse<Settings>(r))

export const updateSettings = (data: Partial<Settings>): Promise<{ ok: boolean }> =>
  fetch(`${BASE}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(r => handleResponse<{ ok: boolean }>(r))

// Resumes
export const listResumes = (): Promise<Resume[]> =>
  fetch(`${BASE}/resumes`).then(r => handleResponse<Resume[]>(r))

export const getResume = (id: number): Promise<Resume> =>
  fetch(`${BASE}/resumes/${id}`).then(r => handleResponse<Resume>(r))

export const createResume = (data: { name: string; content: string; is_default?: boolean; pdf_b64?: string }): Promise<{ id: number }> =>
  fetch(`${BASE}/resumes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(r => handleResponse<{ id: number }>(r))

export const updateResume = (id: number, data: Record<string, unknown>): Promise<{ ok: boolean }> =>
  fetch(`${BASE}/resumes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(r => handleResponse<{ ok: boolean }>(r))

export const deleteResume = (id: number): Promise<{ ok: boolean }> =>
  fetch(`${BASE}/resumes/${id}`, { method: 'DELETE' }).then(r => handleResponse<{ ok: boolean }>(r))

// Applications
export const listApplications = (status?: string): Promise<Application[]> =>
  fetch(`${BASE}/applications${status ? `?status=${status}` : ''}`).then(r => handleResponse<Application[]>(r))

export const getApplication = (id: number): Promise<Application> =>
  fetch(`${BASE}/applications/${id}`).then(r => handleResponse<Application>(r))

export const createApplication = (data: Record<string, unknown>): Promise<{ id: number }> =>
  fetch(`${BASE}/applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(r => handleResponse<{ id: number }>(r))

export const updateApplication = (id: number, data: Record<string, unknown>): Promise<{ ok: boolean }> =>
  fetch(`${BASE}/applications/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(r => handleResponse<{ ok: boolean }>(r))

export const deleteApplication = (id: number): Promise<{ ok: boolean }> =>
  fetch(`${BASE}/applications/${id}`, { method: 'DELETE' }).then(r => handleResponse<{ ok: boolean }>(r))

// AI Health
export const getAIHealth = (): Promise<{ ok: boolean; provider?: string; models?: string[]; model?: string; error?: string }> =>
  fetch(`${BASE}/ai/health`).then(r => handleResponse(r))
