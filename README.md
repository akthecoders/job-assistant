# AI Job Assistant

A self-hosted, privacy-first job application assistant. Reads job postings directly from job boards via a Chrome extension, tailors your resume and generates cover letters using AI, and tracks every application in a local dashboard — **all data stays on your machine**.

## Features

### Core
- **Chrome Extension** — side panel on LinkedIn, Indeed, Glassdoor, ZipRecruiter, Monster. Extracts job title, company, and full description automatically. Updates live as you browse different jobs.
- **Resume Tailoring** — AI rewrites key phrases in your resume to match the job description (minimal targeted changes, not a full rewrite).
- **ATS Score** — scores the tailored resume against the JD (0–100) with matched/missing keywords and recommendations.
- **Cover Letter** — one-click personalised cover letter for each application.
- **PDF Export** — download tailored resume or cover letter as a clean PDF.
- **Application Tracker** — Kanban/table dashboard: Saved → Applied → Interview → Offer / Rejected.

### AI Tools
- **Resume Versions** — save and compare multiple tailored versions of your resume with a side-by-side diff viewer.
- **Salary Coach** — AI-powered salary research and negotiation preparation for any role and location.
- **LinkedIn Optimizer** — analyse and rewrite your LinkedIn headline, summary, and experience bullets for search visibility.
- **Interview Prep** — auto-generates likely interview questions (behavioural, technical, situational) from the job description, with suggested answers.
- **Outreach Messages** — generates cold outreach and follow-up messages tailored to each company and role.
- **Company Research** — one-click AI brief on any company: funding stage, culture, recent news, red/green flags.
- **Job Fit Analysis** — scores how well your resume matches a role before applying.

### Automation
- **Form Auto-Fill** — fills job application forms on any site with one click using your saved profile (name, email, phone, LinkedIn, GitHub, experience, etc.).
- **Job Alerts** — keyword-based job monitoring. Set up alerts that poll for new postings and notify you of matches at your chosen frequency (daily, twice daily, weekly).

### General
- **Analytics** — funnel chart and stats across your application pipeline.
- **AI Provider choice** — use a local **Ollama** model (fully offline) or **Anthropic Claude** (API key required).
- **100% local** — SQLite database, no cloud, no accounts.

---

## Quick Start (5 minutes)

### Prerequisites

| Tool | Min version | Check |
|------|------------|-------|
| Python | 3.11+ | `python3 --version` |
| Node / npm | 18+ | `node --version` |
| Chrome / Chromium | any recent | — |
| Ollama **or** Anthropic API key | — | see below |

### 1 — Clone & start the server

```bash
git clone <repo-url>
cd ai-job-assistant
chmod +x start.sh
./start.sh
```

`start.sh` will:
1. Create a Python virtual environment and install backend dependencies
2. Build the React dashboard
3. Start the FastAPI server at **http://localhost:8000**

Open **http://localhost:8000** — you should see the dashboard.

### 2 — Configure your AI provider

Go to **Settings** in the dashboard and choose one:

#### Option A — Ollama (free, fully offline)
1. Install Ollama from https://ollama.com
2. Pull a model: `ollama pull llama3.2`
3. In Settings: provider = **Ollama**, URL = `http://localhost:11434`, model = `llama3.2`

#### Option B — Anthropic Claude (best results)
1. Get an API key from https://console.anthropic.com
2. In Settings: provider = **Anthropic**, paste your API key, model = `claude-3-5-haiku-20241022`

### 3 — Upload your base resume

1. Go to **Resumes** → **Add Resume**
2. Upload your PDF resume — text is extracted automatically
3. Click **✨ AI Clean Up** to have the AI tidy up any parsing artefacts
4. Check **Set as default** → **Save**

### 4 — Fill your Autofill Profile (optional)

Go to **Settings** → scroll to **Autofill Profile** and fill in your details (name, email, phone, LinkedIn URL, years of experience, etc.). This powers the **Auto-fill Form** button in the extension.

### 5 — Load the Chrome extension

1. Build the extension (if not already built):
   ```bash
   cd extension && npm install && npm run build && cd ..
   ```
2. Open Chrome → `chrome://extensions`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** → select the `extension/dist` folder
5. Pin the extension to your toolbar

### 6 — Use it on a job page

1. Open any job posting on LinkedIn, Indeed, Glassdoor, ZipRecruiter, or Monster
2. Click the extension icon to open the side panel
3. The job title, company, and description are extracted automatically
4. Click **Tailor Resume**, **Cover Letter**, or **Auto-fill Form**
5. Download the PDF or save the application to your tracker

---

## Project Structure

```
ai-job-assistant/
├── backend/                       # FastAPI + SQLite
│   ├── main.py                    # App entry point, lifespan scheduler, serves React build
│   ├── database.py                # Schema + migrations
│   ├── routers/
│   │   ├── resumes.py             # Resume CRUD + PDF parse/generate
│   │   ├── applications.py        # Job tracker CRUD
│   │   ├── ai.py                  # Tailor, cover letter, ATS score, health
│   │   ├── settings.py            # AI provider config
│   │   ├── versions.py            # Resume version history + diff
│   │   ├── salary.py              # Salary research & negotiation coach
│   │   ├── linkedin_optimizer.py  # LinkedIn profile optimisation
│   │   ├── interview.py           # Interview question generator
│   │   ├── outreach.py            # Cold outreach message generator
│   │   ├── company.py             # Company research briefs
│   │   ├── fit.py                 # Job fit scoring
│   │   ├── analytics.py           # Pipeline analytics
│   │   ├── autofill.py            # Autofill profile CRUD
│   │   ├── alerts.py              # Job alert CRUD + polling
│   │   └── emails.py              # Email drafting
│   ├── services/
│   │   ├── ai_provider.py         # Ollama / Anthropic abstraction
│   │   ├── resume_tailor.py       # Minimal-diff tailoring prompt
│   │   ├── cover_letter.py        # Cover letter prompt
│   │   ├── ats_scorer.py          # Keyword scoring prompt
│   │   ├── job_poller.py          # DuckDuckGo job alert polling
│   │   └── pdf_utils.py           # PDF parse (pdfminer) + generate (reportlab)
│   └── requirements.txt
├── frontend/                      # React + Vite + TailwindCSS dashboard
│   └── src/
│       ├── pages/
│       │   ├── Dashboard.tsx      # Application tracker + company research
│       │   ├── Resumes.tsx        # Upload / manage resumes
│       │   ├── ResumeVersions.tsx # Version history with diff viewer
│       │   ├── Settings.tsx       # AI provider + autofill profile settings
│       │   ├── Analytics.tsx      # Pipeline funnel + stats
│       │   ├── InterviewPrep.tsx  # Interview question generator
│       │   ├── LinkedInOptimizer.tsx # LinkedIn profile rewriter
│       │   └── JobAlerts.tsx      # Job alert management
│       ├── api.ts                 # Typed API client
│       └── types.ts
├── extension/                     # Chrome Manifest V3 extension
│   └── src/
│       ├── content/
│       │   ├── extractor.ts       # Job data extraction per site (IIFE-wrapped)
│       │   └── autofill.ts        # Form auto-fill content script (IIFE-wrapped)
│       ├── sidepanel/             # React side panel UI
│       │   ├── App.tsx
│       │   └── components/        # JobInfo, ResumeSection, CoverLetter, ATSScore
│       ├── background.ts          # Service worker
│       └── popup/
├── docs/
│   └── ux-audit.md               # UX/accessibility audit report
└── start.sh                      # One-command startup script
```

---

## API Reference

The backend exposes a REST API at `http://localhost:8000`. Interactive docs available at **http://localhost:8000/docs**.

### Resumes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/resumes` | List all resumes |
| POST | `/api/resumes` | Create resume |
| GET | `/api/resumes/{id}` | Get resume |
| PUT | `/api/resumes/{id}` | Update resume |
| DELETE | `/api/resumes/{id}` | Delete resume |
| GET | `/api/resumes/{id}/pdf` | Download resume as PDF |
| POST | `/api/resumes/parse-pdf` | Extract text from uploaded PDF |
| POST | `/api/resumes/ai-parse` | AI-clean extracted resume text |
| POST | `/api/resumes/download-pdf` | Generate PDF from raw text |

### AI Features
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/tailor-resume` | Tailor resume to JD + get ATS score |
| POST | `/api/ai/cover-letter` | Generate cover letter |
| POST | `/api/ai/ats-score` | Score resume against JD |
| GET | `/api/ai/health` | Check AI provider connectivity |

### Applications
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/applications` | List applications |
| POST | `/api/applications` | Save application |
| PUT | `/api/applications/{id}` | Update application |
| DELETE | `/api/applications/{id}` | Delete application |

### Resume Versions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/versions` | List all saved resume versions |
| POST | `/api/versions` | Save a new version |
| GET | `/api/versions/{id}` | Get version detail |
| DELETE | `/api/versions/{id}` | Delete version |

### Salary Coach
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/salary/research` | Research salary range for a role |
| POST | `/api/salary/negotiate` | Generate negotiation talking points |

### LinkedIn Optimizer
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/linkedin/optimize` | Analyse and rewrite LinkedIn profile sections |

### Interview Prep
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/interview/questions` | Generate interview questions from JD |
| POST | `/api/interview/answer` | Generate suggested answer for a question |

### Outreach
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/outreach/message` | Generate cold outreach or follow-up message |

### Company Research
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/company/research` | Generate company brief |
| GET | `/api/company/cache/{name}` | Get cached company brief |

### Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/summary` | Pipeline funnel stats |

### Autofill Profile
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/autofill/profile` | Get all autofill fields |
| PUT | `/api/autofill/profile` | Update autofill fields |

### Job Alerts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/alerts` | List all alerts |
| POST | `/api/alerts` | Create alert (triggers immediate poll) |
| DELETE | `/api/alerts/{id}` | Delete alert and its results |
| PUT | `/api/alerts/{id}/toggle` | Pause / resume alert |
| GET | `/api/alerts/{id}/results` | Get results for an alert |
| POST | `/api/alerts/{id}/poll` | Manually trigger a poll |
| POST | `/api/alerts/run-all` | Poll all due alerts now |

### Settings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings` | Get AI provider settings |
| PUT | `/api/settings` | Update settings |

---

## Development

### Backend (with hot reload)
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend (dev server)
```bash
cd frontend
npm install
npm run dev   # http://localhost:5173 (proxied to backend on 8000)
```

### Extension (watch mode)
```bash
cd extension
npm install
npm run dev   # rebuilds on save → reload extension in Chrome
```

After any extension rebuild, go to `chrome://extensions` → click ↻ reload on **AI Job Assistant**, then reload any open job board tab.

---

## Supported Job Sites

| Site | Auto-extract |
|------|-------------|
| LinkedIn | ✅ Full (title, company, location, description) |
| Indeed | ✅ Full |
| Glassdoor | ✅ Full |
| ZipRecruiter | ✅ Full |
| Monster | ✅ Full |
| Other sites | ✅ Generic fallback (best-effort) |

The content script watches for SPA navigation — switching between jobs on LinkedIn's feed or search results updates the side panel automatically without a page refresh.

---

## Privacy

- **No telemetry.** No data is sent anywhere except to the AI provider you configure.
- **Local database.** All resumes, applications, and settings are stored in `backend/data.db` (SQLite) on your machine.
- **Anthropic API** — when using Claude, your resume text and job descriptions are sent to Anthropic's API to generate responses. See [Anthropic's privacy policy](https://www.anthropic.com/privacy).
- **Ollama** — runs entirely on your machine. No data leaves your network.
- **Job Alerts** — polls DuckDuckGo search HTML (no API key required). No credentials are stored or transmitted.

---

## Troubleshooting

**`start.sh` fails on Python step**
- Make sure `python3 --version` is 3.11+
- On macOS: `brew install python@3.11`

**"AI Disconnected" / "Offline" in dashboard**
- Go to Settings and verify your provider config
- For Ollama: make sure `ollama serve` is running and the model is pulled
- For Anthropic: check that your API key is valid

**Extension doesn't detect jobs**
- Make sure the extension is loaded from `extension/dist` (not `extension/src`)
- Check that the backend is running at `http://localhost:8000`
- On LinkedIn, the side panel updates automatically; if stale, click the extension icon once to re-open

**Auto-fill doesn't fill anything**
- Go to **Settings → Autofill Profile** and save your details first
- Make sure the backend is running
- Some sites use shadow DOM or iframes — auto-fill may partially work; check the field count in the toast

**PDF text extraction is garbled**
- After uploading a PDF, click **✨ AI Clean Up** — the AI fixes OCR artefacts and reformats sections cleanly

**Extension console error: "Extension context invalidated"**
- This is normal after reloading the extension. Reload the job board tab to re-inject fresh content scripts.

---

## License

MIT
