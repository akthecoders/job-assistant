// Background service worker for AI Job Assistant Chrome Extension

chrome.runtime.onInstalled.addListener(() => {
  // Set side panel to open when the action button is clicked
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err) => {
    console.error('[AI Job Assistant] Failed to set panel behavior:', err)
  })

  console.log('[AI Job Assistant] Extension installed.')
})

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Job data extracted by the content script
  if (message.type === 'JOB_DATA_EXTRACTED') {
    const data = message.data
    console.log('[AI Job Assistant] Job data received from content script:', data?.jobTitle)

    // Persist in storage so the side panel can read it at any time
    chrome.storage.local.set({ currentJob: data }, () => {
      console.log('[AI Job Assistant] Job data saved to storage.')
      sendResponse({ success: true })
    })

    // Return true to keep the message channel open for async sendResponse
    return true
  }

  // Request to open the side panel from the popup or content script
  if (message.type === 'OPEN_SIDE_PANEL') {
    const tabId = message.tabId ?? sender.tab?.id
    if (tabId != null) {
      chrome.sidePanel.open({ tabId }).catch((err) => {
        console.error('[AI Job Assistant] Failed to open side panel:', err)
      })
    }
    sendResponse({ success: true })
    return true
  }

  // Clear current job data
  if (message.type === 'CLEAR_JOB') {
    chrome.storage.local.remove('currentJob', () => {
      sendResponse({ success: true })
    })
    return true
  }
})

// When the user clicks the extension action button, open the side panel
chrome.action.onClicked.addListener((tab) => {
  if (tab.id != null) {
    chrome.sidePanel.open({ tabId: tab.id }).catch((err) => {
      console.error('[AI Job Assistant] Failed to open side panel on action click:', err)
    })
  }
})

// When the active tab changes, try to re-extract job data if we're on a job board
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId)
    if (tab.url && isJobBoardUrl(tab.url)) {
      // Inject content script to re-extract if needed
      // The content script handles its own MutationObserver, so this is just a nudge
      chrome.tabs.sendMessage(activeInfo.tabId, { type: 'RE_EXTRACT' }).catch(() => {
        // Content script may not be loaded yet; that's fine
      })
    }
  } catch {
    // Tab may have been closed
  }
})

// Also listen for navigation events to handle SPA page changes
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && isJobBoardUrl(tab.url)) {
    // Content script will auto-extract on load; no action needed here
    console.log('[AI Job Assistant] Job board tab updated:', tab.url)
  }
})

function isJobBoardUrl(url: string): boolean {
  return (
    url.includes('linkedin.com/jobs') ||
    url.includes('indeed.com/viewjob') ||
    url.includes('indeed.com/jobs') ||
    url.includes('glassdoor.com/job-listing') ||
    url.includes('glassdoor.com/Jobs') ||
    url.includes('ziprecruiter.com/jobs') ||
    url.includes('monster.com/job-openings')
  )
}

export {}
