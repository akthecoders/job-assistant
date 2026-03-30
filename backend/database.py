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
