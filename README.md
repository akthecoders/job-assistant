# AI Job Assistant

A self-hosted, privacy-first job application assistant. Reads job postings directly from job boards via a Chrome extension, tailors your resume and generates cover letters using AI, and tracks every application in a local dashboard — **all data stays on your machine**.

![Dashboard](docs/dashboard.png)

## Features

- **Chrome Extension** — side panel on LinkedIn, Indeed, Glassdoor, ZipRecruiter, Monster. Extracts job title, company, and full description automatically. Updates live as you browse different jobs.
- **Resume Tailoring** — AI rewrites key phrases in your resume to match the job description (minimal targeted changes, not a full rewrite).
- **ATS Score** — scores the tailored resume against the JD (0–100) with matched/missing keywords and recommendations.
- **Cover Letter** — one-click personalised cover letter for each application.
- **PDF Export** — download tailored resume or cover letter as a clean PDF.
- **Application Tracker** — Kanban/table dashboard: Saved → Applied → Interview → Offer / Rejected.
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

### 4 — Load the Chrome extension

1. Build the extension (if not already built):
   ```bash
   cd extension && npm install && npm run build && cd ..
   ```
2. Open Chrome → `chrome://extensions`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** → select the `extension/dist` folder
5. Pin the extension to your toolbar

### 5 — Use it on a job page

1. Open any job posting on LinkedIn, Indeed, Glassdoor, ZipRecruiter, or Monster
2. Click the extension icon to open the side panel
3. The job title, company, and description are extracted automatically
4. Click **Tailor Resume** or **Cover Letter**
5. Download the PDF or save the application to your tracker

---

## Project Structure

```
ai-job-assistant/
├── backend/                  # FastAPI + SQLite
│   ├── main.py               # App entry point, serves React build
│   ├── database.py           # Schema + migrations
│   ├── routers/
│   │   ├── resumes.py        # Resume CRUD + PDF parse/generate
│   │   ├── applications.py   # Job tracker CRUD
│   │   ├── ai.py             # Tailor, cover letter, ATS score, health
│   │   └── settings.py       # AI provider config
│   ├── services/
│   │   ├── ai_provider.py    # Ollama / Anthropic abstraction
│   │   ├── resume_tailor.py  # Minimal-diff tailoring prompt
│   │   ├── cover_letter.py   # Cover letter prompt
│   │   ├── ats_scorer.py     # Keyword scoring prompt
│   │   └── pdf_utils.py      # PDF parse (pdfminer) + generate (reportlab)
│   └── requirements.txt
├── frontend/                 # React + Vite + TailwindCSS dashboard
│   └── src/
│       ├── pages/
│       │   ├── Dashboard.tsx # Application tracker
│       │   ├── Resumes.tsx   # Upload / manage resumes
│       │   └── Settings.tsx  # AI provider settings
│       ├── api.ts            # Typed API client
│       └── types.ts
├── extension/                # Chrome Manifest V3 extension
│   └── src/
│       ├── content/
│       │   └── extractor.ts  # Job data extraction per site
│       ├── sidepanel/        # React side panel UI
│       │   ├── App.tsx
│       │   └── components/   # JobInfo, ResumeSection, CoverLetter, ATSScore
│       ├── background.ts     # Service worker
│       └── popup/
└── start.sh                  # One-command startup script
```

---

## API Reference

The backend exposes a REST API at `http://localhost:8000`. Interactive docs available at **http://localhost:8000/docs**.

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
| POST | `/api/ai/tailor-resume` | Tailor resume to JD + get ATS score |
| POST | `/api/ai/cover-letter` | Generate cover letter |
| POST | `/api/ai/ats-score` | Score resume against JD |
| GET | `/api/ai/health` | Check AI provider connectivity |
| GET | `/api/applications` | List applications |
| POST | `/api/applications` | Save application |
| PUT | `/api/applications/{id}` | Update application |
| DELETE | `/api/applications/{id}` | Delete application |
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

**PDF text extraction is garbled**
- After uploading a PDF, click **✨ AI Clean Up** — the AI fixes OCR artefacts and reformats sections cleanly

---

## License

MIT
