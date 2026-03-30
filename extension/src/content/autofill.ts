// Content script: detects and fills job application form fields

interface AutofillProfile {
  full_name?: string
  email?: string
  phone?: string
  location?: string
  linkedin_url?: string
  portfolio_url?: string
  github_url?: string
  years_experience?: number
  current_title?: string
  current_company?: string
  willing_to_relocate?: boolean
  work_authorization?: string
  desired_salary?: string
  notice_period?: string
}

// Map of field name/label patterns to profile keys
const FIELD_MAP: Array<{ patterns: RegExp[]; key: keyof AutofillProfile; inputType?: string }> = [
  { patterns: [/full.?name/i, /your.?name/i, /applicant.?name/i], key: 'full_name' },
  { patterns: [/first.?name/i, /given.?name/i], key: 'full_name' }, // will use first word
  { patterns: [/last.?name/i, /family.?name/i, /surname/i], key: 'full_name' }, // will use last word
  { patterns: [/email/i, /e-mail/i], key: 'email', inputType: 'email' },
  { patterns: [/phone/i, /mobile/i, /cell/i, /telephone/i], key: 'phone', inputType: 'tel' },
  { patterns: [/location/i, /city/i, /address/i, /where.?are.?you/i], key: 'location' },
  { patterns: [/linkedin/i], key: 'linkedin_url', inputType: 'url' },
  { patterns: [/portfolio/i, /personal.?site/i, /website/i], key: 'portfolio_url', inputType: 'url' },
  { patterns: [/github/i], key: 'github_url', inputType: 'url' },
  { patterns: [/years.?of.?exp/i, /experience.?\(?years/i, /how.?many.?years/i], key: 'years_experience' },
  { patterns: [/current.?title/i, /job.?title/i, /position/i, /role/i], key: 'current_title' },
  { patterns: [/current.?company/i, /employer/i, /company/i], key: 'current_company' },
  { patterns: [/work.?auth/i, /visa/i, /authorized.?to.?work/i, /sponsorship/i], key: 'work_authorization' },
  { patterns: [/salary/i, /compensation/i, /expected.?pay/i, /desired.?pay/i], key: 'desired_salary' },
  { patterns: [/notice.?period/i, /start.?date/i, /availability/i, /when.?can.?you.?start/i], key: 'notice_period' },
]

function getLabelText(input: Element): string {
  // Try label[for=id]
  const id = input.getAttribute('id')
  if (id) {
    const label = document.querySelector(`label[for="${id}"]`)
    if (label) return label.textContent?.trim() || ''
  }
  // Try aria-label
  const aria = input.getAttribute('aria-label')
  if (aria) return aria

  // Try placeholder
  const ph = (input as HTMLInputElement).placeholder
  if (ph) return ph

  // Try parent label
  const parentLabel = input.closest('label')
  if (parentLabel) return parentLabel.textContent?.trim() || ''

  // Try name attribute
  return input.getAttribute('name') || ''
}

function getProfileValue(key: keyof AutofillProfile, profile: AutofillProfile, labelText: string): string {
  const raw = profile[key]
  if (raw === undefined || raw === null) return ''

  // Special handling for first/last name splits
  if (key === 'full_name' && typeof raw === 'string') {
    const parts = raw.trim().split(/\s+/)
    if (/first.?name|given.?name/i.test(labelText)) return parts[0] || raw
    if (/last.?name|family.?name|surname/i.test(labelText)) return parts.slice(1).join(' ') || raw
    return raw
  }

  return String(raw)
}

function fillInputs(profile: AutofillProfile): number {
  let filled = 0
  const inputs = Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]), textarea'
  ))

  for (const input of inputs) {
    if ((input as HTMLInputElement).disabled || input.readOnly) continue
    if (input.value && input.value.length > 0) continue // don't overwrite filled fields

    const labelText = getLabelText(input)
    if (!labelText) continue

    for (const mapping of FIELD_MAP) {
      const matches = mapping.patterns.some(p => p.test(labelText))
      if (!matches) continue

      // If inputType is specified, match it for email/url/tel fields
      if (mapping.inputType && input instanceof HTMLInputElement) {
        const iType = input.type
        if (mapping.inputType === 'email' && iType !== 'email' && iType !== 'text') continue
      }

      const value = getProfileValue(mapping.key, profile, labelText)
      if (!value) continue

      // Set value and trigger React/Vue change events
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
      const nativeTextareaSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
      if (input instanceof HTMLInputElement && nativeInputValueSetter) {
        nativeInputValueSetter.call(input, value)
      } else if (input instanceof HTMLTextAreaElement && nativeTextareaSetter) {
        nativeTextareaSetter.call(input, value)
      } else {
        input.value = value
      }

      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
      filled++
      break
    }
  }

  return filled
}

// Listen for autofill message from side panel
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'AUTOFILL_FORM') {
    const profile: AutofillProfile = message.profile
    const count = fillInputs(profile)
    sendResponse({ filled: count })
  }
})

export {}
