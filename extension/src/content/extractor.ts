// Content script: extracts job data from supported job board pages

interface JobData {
  jobTitle: string
  company: string
  location: string
  description: string
  url: string
  source: string
  extractedAt: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function queryText(selectors: string[]): string {
  for (const sel of selectors) {
    try {
      const el = document.querySelector(sel)
      if (el && el.textContent?.trim()) {
        return el.textContent.trim()
      }
    } catch {
      // Invalid selector; skip
    }
  }
  return ''
}

function queryAttr(selectors: string[], attr: string): string {
  for (const sel of selectors) {
    try {
      const el = document.querySelector(sel)
      if (el) {
        const val = el.getAttribute(attr)
        if (val?.trim()) return val.trim()
      }
    } catch {
      // skip
    }
  }
  return ''
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

// ─── Site-Specific Extractors ────────────────────────────────────────────────

function extractLinkedIn(): Partial<JobData> {
  const jobTitle = queryText([
    '.job-details-jobs-unified-top-card__job-title h1',
    'h1.t-24',
    '.top-card-layout__title',
    'h1[class*="job-title"]',
    '.jobs-unified-top-card__job-title h1',
    'h1',
  ])

  const company = queryText([
    '.job-details-jobs-unified-top-card__company-name a',
    '.topcard__org-name-link',
    '.jobs-unified-top-card__company-name a',
    '.top-card-layout__card .topcard__org-name-link',
    '[class*="company-name"]',
  ])

  const location = queryText([
    '.job-details-jobs-unified-top-card__primary-description-without-tagline .tvm__text',
    '.topcard__flavor--bullet',
    '.jobs-unified-top-card__bullet',
    '[class*="workplace-type"]',
    '.job-details-jobs-unified-top-card__workplace-type',
  ])

  const descEl =
    document.querySelector('#job-details') ||
    document.querySelector('.jobs-description__content') ||
    document.querySelector('.jobs-box__html-content') ||
    document.querySelector('[class*="jobs-description"]')

  const description = descEl ? cleanText(descEl.textContent || '') : ''

  return { jobTitle, company, location, description, source: 'LinkedIn' }
}

function extractIndeed(): Partial<JobData> {
  const jobTitle = queryText([
    'h1.jobsearch-JobInfoHeader-title',
    '[data-testid="jobsearch-JobInfoHeader-title"]',
    'h1[class*="JobTitle"]',
    '.jobsearch-JobInfoHeader-title',
    'h1',
  ])

  const company = queryText([
    '[data-testid="inlineHeader-companyName"] a',
    '[data-testid="inlineHeader-companyName"]',
    '.icl-u-lg-mr--sm',
    '[class*="companyName"]',
    '.jobsearch-CompanyInfoContainer a',
  ])

  const location = queryText([
    '[data-testid="job-location"]',
    '.jobsearch-JobInfoHeader-subtitle [class*="location"]',
    '[class*="jobLocation"]',
    '.icl-IconedField--location',
  ])

  const descEl =
    document.querySelector('#jobDescriptionText') ||
    document.querySelector('[id*="jobDescription"]') ||
    document.querySelector('.jobsearch-jobDescriptionText')

  const description = descEl ? cleanText(descEl.textContent || '') : ''

  return { jobTitle, company, location, description, source: 'Indeed' }
}

function extractGlassdoor(): Partial<JobData> {
  const jobTitle = queryText([
    '[data-test="job-title"]',
    '.heading_Heading__BqX5J',
    '[class*="JobTitle"]',
    'h1[class*="title"]',
    'h1',
  ])

  const company = queryText([
    '[data-test="employer-name"]',
    '[class*="employer-name"]',
    '[class*="EmployerName"]',
    '.header_EmployerName__Oie7u',
  ])

  const location = queryText([
    '[data-test="location"]',
    '[class*="location"]',
    '.header_Location__XMuuz',
  ])

  const descEl =
    document.querySelector('[data-test="jobDescriptionContent"]') ||
    document.querySelector('.jobDescriptionContent') ||
    document.querySelector('[class*="JobDescription"]') ||
    document.querySelector('[class*="jobDescription"]')

  const description = descEl ? cleanText(descEl.textContent || '') : ''

  return { jobTitle, company, location, description, source: 'Glassdoor' }
}

function extractZipRecruiter(): Partial<JobData> {
  const jobTitle = queryText([
    'h1.job_title',
    '[class*="JobTitle"]',
    'h1[class*="title"]',
    '.job_header h1',
    'h1',
  ])

  const company = queryText([
    '[class*="hiring_company"] a',
    '[class*="hiring_company"]',
    'a[class*="company"]',
    '[class*="Company"]',
  ])

  const location = queryText([
    '[class*="location"]',
    '[class*="Location"]',
    '.location_pin',
    '[data-name="location"]',
  ])

  const descEl =
    document.querySelector('[class*="jobDescriptionSection"]') ||
    document.querySelector('.jobDescriptionSection') ||
    document.querySelector('[class*="job_description"]') ||
    document.querySelector('#job_desc')

  const description = descEl ? cleanText(descEl.textContent || '') : ''

  return { jobTitle, company, location, description, source: 'ZipRecruiter' }
}

function extractMonster(): Partial<JobData> {
  const jobTitle = queryText([
    'h1.title',
    '[class*="JobTitle"]',
    '.job-header h1',
    'h1',
  ])

  const company = queryText([
    '[class*="company-name"]',
    '.company-name',
    '[itemprop="hiringOrganization"]',
  ])

  const location = queryText([
    '[class*="location"]',
    '[itemprop="jobLocation"]',
    '.location',
  ])

  const descEl =
    document.querySelector('[class*="job-description"]') ||
    document.querySelector('.job-description') ||
    document.querySelector('[id*="JobDescription"]')

  const description = descEl ? cleanText(descEl.textContent || '') : ''

  return { jobTitle, company, location, description, source: 'Monster' }
}

function extractGeneric(): Partial<JobData> {
  // Try meta tags first
  const ogTitle = queryAttr(['meta[property="og:title"]'], 'content')

  // Try common H1 patterns
  const jobTitle =
    queryText(['h1[class*="job"]', 'h1[class*="title"]', 'h1[class*="position"]', 'h1']) ||
    ogTitle

  // Try to find company from structured data
  let company = ''
  const ldJson = document.querySelector('script[type="application/ld+json"]')
  if (ldJson) {
    try {
      const data = JSON.parse(ldJson.textContent || '{}')
      if (data['@type'] === 'JobPosting') {
        company = data.hiringOrganization?.name || ''
        if (!company && data.employer?.name) company = data.employer.name
      }
    } catch {
      // ignore
    }
  }

  if (!company) {
    company = queryText([
      '[class*="company"]',
      '[class*="employer"]',
      '[itemprop="hiringOrganization"]',
    ])
  }

  const location = queryText([
    '[class*="location"]',
    '[itemprop="jobLocation"]',
    '[class*="city"]',
  ])

  // Take the largest text block on the page as description
  let description = ''
  const candidates = Array.from(document.querySelectorAll('div, article, section'))
  let maxLen = 0
  for (const el of candidates) {
    const text = el.textContent?.trim() || ''
    if (text.length > maxLen && text.length < 20000) {
      maxLen = text.length
      description = cleanText(text)
    }
  }

  return { jobTitle, company, location, description, source: 'Generic' }
}

// ─── Main Extraction Logic ───────────────────────────────────────────────────

function detectSite(): string {
  const host = window.location.hostname
  if (host.includes('linkedin.com')) return 'linkedin'
  if (host.includes('indeed.com')) return 'indeed'
  if (host.includes('glassdoor.com')) return 'glassdoor'
  if (host.includes('ziprecruiter.com')) return 'ziprecruiter'
  if (host.includes('monster.com')) return 'monster'
  return 'generic'
}

function extractJobData(): JobData | null {
  const site = detectSite()

  let partial: Partial<JobData> = {}

  switch (site) {
    case 'linkedin':
      partial = extractLinkedIn()
      break
    case 'indeed':
      partial = extractIndeed()
      break
    case 'glassdoor':
      partial = extractGlassdoor()
      break
    case 'ziprecruiter':
      partial = extractZipRecruiter()
      break
    case 'monster':
      partial = extractMonster()
      break
    default:
      partial = extractGeneric()
  }

  // If we couldn't extract a title, try generic as fallback
  if (!partial.jobTitle) {
    const fallback = extractGeneric()
    partial = { ...fallback, ...partial }
  }

  // Only send if we have at least a title
  if (!partial.jobTitle) {
    console.log('[AI Job Assistant] Could not extract job title from this page.')
    return null
  }

  return {
    jobTitle: partial.jobTitle || '',
    company: partial.company || '',
    location: partial.location || '',
    description: partial.description || '',
    url: window.location.href,
    source: partial.source || 'Unknown',
    extractedAt: new Date().toISOString(),
  }
}

function sendJobData(data: JobData) {
  chrome.runtime.sendMessage({ type: 'JOB_DATA_EXTRACTED', data }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn('[AI Job Assistant] Error sending job data:', chrome.runtime.lastError.message)
    } else {
      console.log('[AI Job Assistant] Job data sent successfully:', response)
    }
  })
}

// ─── Extraction with Retry ───────────────────────────────────────────────────

let lastExtractedUrl = ''
let lastExtractedTitle = ''
let extractionTimer: ReturnType<typeof setTimeout> | null = null

function scheduleExtraction(delayMs = 1500) {
  if (extractionTimer) clearTimeout(extractionTimer)
  extractionTimer = setTimeout(() => {
    const data = extractJobData()
    if (data) {
      sendJobData(data)
      lastExtractedUrl = window.location.href
      lastExtractedTitle = data.jobTitle
    }
    extractionTimer = null
  }, delayMs)
}

// Initial extraction
scheduleExtraction(1500)

// ─── MutationObserver for SPAs (LinkedIn) ───────────────────────────────────

// Read current job title directly from DOM (fast, no full extraction)
function peekJobTitle(): string {
  // LinkedIn selectors most likely to reflect the currently-displayed job
  const selectors = [
    '.job-details-jobs-unified-top-card__job-title h1',
    'h1.t-24',
    '.jobs-unified-top-card__job-title h1',
    '.top-card-layout__title',
    'h1[class*="job-title"]',
    'h1',
  ]
  for (const sel of selectors) {
    const el = document.querySelector(sel)
    if (el?.textContent?.trim()) return el.textContent.trim()
  }
  return ''
}

const observer = new MutationObserver(() => {
  const urlChanged = window.location.href !== lastExtractedUrl
  const titleChanged = peekJobTitle() !== lastExtractedTitle && peekJobTitle() !== ''

  if (urlChanged || titleChanged) {
    scheduleExtraction(1000)
  }
})

observer.observe(document.body, {
  childList: true,
  subtree: true,
})

// ─── SPA Navigation Events ──────────────────────────────────────────────────

window.addEventListener('popstate', () => {
  scheduleExtraction(800)
})

// Intercept pushState for LinkedIn SPA navigation
const originalPushState = history.pushState.bind(history)
history.pushState = function (...args) {
  originalPushState(...args)
  scheduleExtraction(1000)
}

const originalReplaceState = history.replaceState.bind(history)
history.replaceState = function (...args) {
  originalReplaceState(...args)
  if (window.location.href !== lastExtractedUrl) {
    scheduleExtraction(1000)
  }
}

// ─── Listen for RE_EXTRACT message from background ──────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'RE_EXTRACT') {
    scheduleExtraction(500)
    sendResponse({ success: true })
  }
})

export {}
