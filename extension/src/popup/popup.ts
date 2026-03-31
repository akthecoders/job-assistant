// Popup script for AI Job Assistant
import { getBackendUrl, setBackendUrl, DEFAULT_BACKEND_URL } from '../lib/config'

const urlInput = document.getElementById('backendUrl') as HTMLInputElement
const saveUrlBtn = document.getElementById('saveUrl') as HTMLButtonElement
const urlStatus = document.getElementById('urlStatus') as HTMLSpanElement

// Load saved URL on open
getBackendUrl().then(url => {
  urlInput.value = url
  urlInput.placeholder = DEFAULT_BACKEND_URL
})

saveUrlBtn.addEventListener('click', async () => {
  const url = urlInput.value.trim() || DEFAULT_BACKEND_URL
  await setBackendUrl(url)
  urlStatus.textContent = 'Saved!'
  urlStatus.style.color = '#34d399'
  setTimeout(() => { urlStatus.textContent = '' }, 2000)
})

document.getElementById('openPanel')!.addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab.id != null) {
      await chrome.sidePanel.open({ tabId: tab.id })
    }
  } catch (err) {
    console.error('[AI Job Assistant] Failed to open side panel:', err)
  } finally {
    window.close()
  }
})

document.getElementById('openDashboard')!.addEventListener('click', async () => {
  const url = await getBackendUrl()
  chrome.tabs.create({ url })
  window.close()
})

export {}
