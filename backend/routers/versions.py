import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from database import get_db
from services.diff_utils import compute_diff

router = APIRouter(prefix="/api/versions", tags=["versions"])


class SnapshotRequest(BaseModel):
    label: Optional[str] = None


@router.post("/{app_id}/snapshot")
async def create_snapshot(app_id: int, req: SnapshotRequest):
    """Save current tailored_resume as a versioned snapshot."""
    async with get_db() as db:
        async with db.execute(
            "SELECT tailored_resume, resume_id, ats_score FROM applications WHERE id = ?",
            (app_id,)
        ) as cur:
            row = await cur.fetchone()

    if not row:
        raise HTTPException(404, "Application not found")
    if not row["tailored_resume"]:
        raise HTTPException(422, "No tailored resume to snapshot yet")

    # Count existing versions to auto-label
    async with get_db() as db:
        async with db.execute(
            "SELECT COUNT(*) as cnt FROM resume_versions WHERE application_id = ?", (app_id,)
        ) as cur:
            cnt_row = await cur.fetchone()
        version_num = (cnt_row["cnt"] or 0) + 1
        label = req.label or f"v{version_num}"

        async with db.execute(
            """INSERT INTO resume_versions (application_id, resume_id, version_label, resume_text, ats_score)
               VALUES (?, ?, ?, ?, ?) RETURNING id""",
            (app_id, row["resume_id"], label, row["tailored_resume"], row["ats_score"])
        ) as cur:
            new_row = await cur.fetchone()
        await db.commit()

    return {"id": new_row[0], "label": label, "ats_score": row["ats_score"]}


@router.get("/{app_id}")
async def list_versions(app_id: int):
    """List all versions for an application, newest first."""
    async with get_db() as db:
        async with db.execute(
            """SELECT id, application_id, version_label, ats_score, created_at
               FROM resume_versions WHERE application_id = ?
               ORDER BY created_at DESC""",
            (app_id,)
        ) as cur:
            rows = await cur.fetchall()
    return [dict(r) for r in rows]


@router.get("/{app_id}/diff/{v1_id}/{v2_id}")
async def get_diff(app_id: int, v1_id: int, v2_id: int):
    """Return line-level diff between two version snapshots."""
    async with get_db() as db:
        async with db.execute(
            "SELECT id, version_label, resume_text, ats_score FROM resume_versions WHERE id IN (?, ?) AND application_id = ?",
            (v1_id, v2_id, app_id)
        ) as cur:
            rows = await cur.fetchall()

    if len(rows) != 2:
        raise HTTPException(404, "One or both versions not found for this application")

    versions = {r["id"]: dict(r) for r in rows}
    v1 = versions[v1_id]
    v2 = versions[v2_id]

    diff = compute_diff(v1["resume_text"], v2["resume_text"])

    return {
        "v1": {"id": v1_id, "label": v1["version_label"], "ats_score": v1["ats_score"]},
        "v2": {"id": v2_id, "label": v2["version_label"], "ats_score": v2["ats_score"]},
        "diff": diff,
        "stats": {
            "added": sum(1 for d in diff if d["type"] == "add"),
            "removed": sum(1 for d in diff if d["type"] == "remove"),
            "unchanged": sum(1 for d in diff if d["type"] == "equal"),
        }
    }


@router.delete("/{version_id}")
async def delete_version(version_id: int):
    async with get_db() as db:
        await db.execute("DELETE FROM resume_versions WHERE id = ?", (version_id,))
        await db.commit()
    return {"ok": True}
