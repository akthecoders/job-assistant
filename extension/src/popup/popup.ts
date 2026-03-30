// Popup script for AI Job Assistant

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

document.getElementById('openDashboard')!.addEventListener('click', () => {
  chrome.tabs.create({ url: 'http://localhost:8000' })
  window.close()
})

export {}
