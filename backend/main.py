import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path
from contextlib import asynccontextmanager

from database import init_db
from routers import resumes, applications, ai, settings, fit, company, interview, outreach, emails, analytics, versions, linkedin_optimizer, salary, autofill
from routers import alerts
from services.job_poller import run_due_alerts


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()

    async def scheduler_loop():
        while True:
            try:
                await run_due_alerts()
            except Exception as e:
                print(f"[scheduler] error: {e}")
            await asyncio.sleep(3600)  # check every hour

    asyncio.create_task(scheduler_loop())
    yield


app = FastAPI(title="AI Job Assistant", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Extension and localhost dashboard
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(resumes.router)
app.include_router(applications.router)
app.include_router(ai.router)
app.include_router(settings.router)
app.include_router(fit.router)
app.include_router(company.router)
app.include_router(interview.router)
app.include_router(outreach.router)
app.include_router(emails.router)
app.include_router(analytics.router)
app.include_router(versions.router)
app.include_router(linkedin_optimizer.router)
app.include_router(salary.router)
app.include_router(autofill.router)
app.include_router(alerts.router)

# Serve React dashboard build if it exists
FRONTEND_DIST = Path(__file__).parent.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")

    @app.get("/")
    async def serve_index():
        return FileResponse(str(FRONTEND_DIST / "index.html"))

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file = FRONTEND_DIST / full_path
        if file.exists() and file.is_file():
            return FileResponse(str(file))
        return FileResponse(str(FRONTEND_DIST / "index.html"))
else:
    @app.get("/")
    async def root():
        return {
            "message": "AI Job Assistant API is running",
            "docs": "/docs",
            "note": "Run 'npm run build' in frontend/ to serve the dashboard here",
        }
