export const DEFAULT_BACKEND_URL = 'http://localhost:8000'
const STORAGE_KEY = 'backendUrl'

/** Read the user-configured backend URL from chrome.storage.local */
export async function getBackendUrl(): Promise<string> {
  return new Promise(resolve => {
    chrome.storage.local.get(STORAGE_KEY, res => {
      const raw = (res[STORAGE_KEY] as string | undefined) ?? ''
      resolve(raw.replace(/\/$/, '') || DEFAULT_BACKEND_URL)
    })
  })
}

/** Persist a new backend URL to chrome.storage.local */
export async function setBackendUrl(url: string): Promise<void> {
  const clean = url.replace(/\/$/, '') || DEFAULT_BACKEND_URL
  return new Promise(resolve => {
    chrome.storage.local.set({ [STORAGE_KEY]: clean }, resolve)
  })
}

/** Subscribe to backend URL changes made in any extension page */
export function onBackendUrlChanged(cb: (url: string) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>) => {
    if (STORAGE_KEY in changes) {
      const raw = (changes[STORAGE_KEY].newValue as string | undefined) ?? ''
      cb(raw.replace(/\/$/, '') || DEFAULT_BACKEND_URL)
    }
  }
  chrome.storage.local.onChanged.addListener(listener)
  return () => chrome.storage.local.onChanged.removeListener(listener)
}
