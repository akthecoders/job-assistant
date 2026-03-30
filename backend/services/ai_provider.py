import httpx
import json
from typing import Optional


class AIProvider:
    def __init__(
        self,
        provider: str,
        model: str,
        api_key: str = "",
        ollama_url: str = "http://localhost:11434",
    ):
        self.provider = provider
        self.model = model
        self.api_key = api_key
        self.ollama_url = ollama_url.rstrip("/")

    async def complete(self, system: str, user: str) -> str:
        if self.provider == "anthropic":
            return await self._anthropic_complete(system, user)
        return await self._ollama_complete(system, user)

    async def _anthropic_complete(self, system: str, user: str) -> str:
        import anthropic

        client = anthropic.AsyncAnthropic(api_key=self.api_key)
        msg = await client.messages.create(
            model=self.model,
            max_tokens=4096,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        return msg.content[0].text

    async def _ollama_complete(self, system: str, user: str) -> str:
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "stream": False,
        }
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(f"{self.ollama_url}/api/chat", json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data["message"]["content"]

    @classmethod
    async def from_db(cls, db) -> "AIProvider":
        from database import get_setting

        provider = await get_setting(db, "provider") or "ollama"
        ollama_url = await get_setting(db, "ollama_url") or "http://localhost:11434"
        ollama_model = await get_setting(db, "ollama_model") or "llama3.2"
        anthropic_model = await get_setting(db, "anthropic_model") or "claude-haiku-4-5-20251001"
        anthropic_api_key = await get_setting(db, "anthropic_api_key") or ""

        model = anthropic_model if provider == "anthropic" else ollama_model
        return cls(
            provider=provider,
            model=model,
            api_key=anthropic_api_key,
            ollama_url=ollama_url,
        )
