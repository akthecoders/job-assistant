import aiosqlite
import json
from pathlib import Path
from contextlib import asynccontextmanager

DB_PATH = Path(__file__).parent / "data.db"

CREATE_TABLES = """
CREATE TABLE IF NOT EXISTS resumes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_title TEXT NOT NULL,
    company TEXT NOT NULL,
    job_url TEXT,
    job_description TEXT,
    status TEXT NOT NULL DEFAULT 'saved',
    resume_id INTEGER REFERENCES resumes(id),
    tailored_resume TEXT,
    cover_letter TEXT,
    ats_score INTEGER,
    ats_details TEXT,
    notes TEXT,
    applied_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

INSERT OR IGNORE INTO settings (key, value) VALUES
    ('provider', '"ollama"'),
    ('ollama_url', '"http://localhost:11434"'),
    ('ollama_model', '"llama3.2"'),
    ('anthropic_model', '"claude-3-5-haiku-20241022"'),
    ('anthropic_api_key', '""');

CREATE TABLE IF NOT EXISTS interview_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    question_type TEXT NOT NULL,
    user_answer TEXT,
    ai_score INTEGER,
    ai_feedback TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS company_research (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_name TEXT NOT NULL UNIQUE,
    funding_stage TEXT,
    headcount_trend TEXT,
    recent_news TEXT,
    glassdoor_sentiment TEXT,
    interview_patterns TEXT,
    raw_signals TEXT,
    fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS outreach_drafts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    outreach_type TEXT NOT NULL,
    contact_name TEXT,
    contact_title TEXT,
    draft_text TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS email_drafts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    email_type TEXT NOT NULL,
    subject TEXT,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS salary_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    role_title TEXT NOT NULL,
    location TEXT,
    range_low INTEGER,
    range_mid INTEGER,
    range_high INTEGER,
    negotiation_script TEXT,
    counterargument_prep TEXT,
    data_sources TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS resume_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    resume_id INTEGER REFERENCES resumes(id),
    version_label TEXT,
    resume_text TEXT NOT NULL,
    diff_from_base TEXT,
    ats_score INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS autofill_profile (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    field_key TEXT NOT NULL UNIQUE,
    field_value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS job_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query_keywords TEXT NOT NULL,
    location TEXT,
    sources TEXT NOT NULL DEFAULT '["linkedin","indeed"]',
    is_active INTEGER NOT NULL DEFAULT 1,
    last_run_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS job_alert_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_id INTEGER NOT NULL REFERENCES job_alerts(id) ON DELETE CASCADE,
    job_title TEXT NOT NULL,
    company TEXT NOT NULL,
    job_url TEXT,
    match_score INTEGER,
    is_seen INTEGER NOT NULL DEFAULT 0,
    found_at TEXT NOT NULL DEFAULT (datetime('now'))
);
"""


@asynccontextmanager
async def get_db():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        yield db


async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        for stmt in CREATE_TABLES.strip().split(";"):
            stmt = stmt.strip()
            if stmt:
                await db.execute(stmt)
        # Safe migration: add pdf_bytes column if it doesn't exist yet
        try:
            await db.execute("ALTER TABLE resumes ADD COLUMN pdf_bytes BLOB")
        except Exception:
            pass  # column already exists
        try:
            await db.execute("ALTER TABLE applications ADD COLUMN fit_score INTEGER")
        except Exception:
            pass
        try:
            await db.execute("ALTER TABLE applications ADD COLUMN fit_details TEXT")
        except Exception:
            pass
        try:
            await db.execute("ALTER TABLE applications ADD COLUMN posting_age_days INTEGER")
        except Exception:
            pass
        try:
            await db.execute("ALTER TABLE applications ADD COLUMN is_ghost_flag INTEGER DEFAULT 0")
        except Exception:
            pass
        try:
            await db.execute("ALTER TABLE applications ADD COLUMN company_research_id INTEGER")
        except Exception:
            pass
        try:
            await db.execute("ALTER TABLE resumes ADD COLUMN resume_type TEXT DEFAULT 'general'")
        except Exception:
            pass
        await db.commit()


async def get_setting(db: aiosqlite.Connection, key: str):
    async with db.execute("SELECT value FROM settings WHERE key = ?", (key,)) as cur:
        row = await cur.fetchone()
    return json.loads(row["value"]) if row else None


async def set_setting(db: aiosqlite.Connection, key: str, value):
    await db.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
        (key, json.dumps(value)),
    )
    await db.commit()
