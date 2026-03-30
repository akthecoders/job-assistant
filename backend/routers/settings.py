from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
import aiosqlite
from database import get_db, get_setting, set_setting

router = APIRouter(prefix="/api/settings", tags=["settings"])


class SettingsPayload(BaseModel):
    provider: Optional[str] = None
    ollama_url: Optional[str] = None
    ollama_model: Optional[str] = None
    anthropic_model: Optional[str] = None
    anthropic_api_key: Optional[str] = None


@router.get("")
async def read_settings():
    async with get_db() as db:
        return {
            "provider": await get_setting(db, "provider"),
            "ollama_url": await get_setting(db, "ollama_url"),
            "ollama_model": await get_setting(db, "ollama_model"),
            "anthropic_model": await get_setting(db, "anthropic_model"),
            "anthropic_api_key": await get_setting(db, "anthropic_api_key"),
        }


@router.put("")
async def update_settings(payload: SettingsPayload):
    async with get_db() as db:
        updates = payload.model_dump(exclude_none=True)
        for key, value in updates.items():
            await set_setting(db, key, value)
    return await read_settings()
