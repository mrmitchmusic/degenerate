from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class GlobalState(BaseModel):
    play_count: float = 0.0
    total_damage: float = 0.0
    status: Literal["alive", "dead"] = "alive"
    filename: str = "mitch_os_88_master.wav"
    duration_seconds: float = 0.0
    sample_rate: int = 44100
    integrity_percent: float = 100.0


class SessionSnapshot(BaseModel):
    session_id: str
    queue_position: int
    is_active: bool
    status: Literal["queued", "active", "ended"]
    listened_seconds: float = 0.0
    paused_seconds: float = 0.0
    started_at: float | None = None
    last_heartbeat: float | None = None
    estimated_wait_seconds: float = 0.0
    max_pause_seconds: float = 30.0


class SessionOpenResponse(BaseModel):
    session: SessionSnapshot
    state: GlobalState


class OpenSessionPayload(BaseModel):
    browser_session_id: str | None = Field(default=None, min_length=1)
    client_id: str | None = Field(default=None, min_length=1)

    def resolved_browser_session_id(self) -> str:
        return (self.browser_session_id or self.client_id or "").strip()


class HeartbeatPayload(BaseModel):
    listened_seconds: float = Field(ge=0.0)
    paused_seconds: float = Field(ge=0.0)
    is_paused: bool = False


class EndSessionPayload(BaseModel):
    listened_seconds: float = Field(ge=0.0)
    paused_seconds: float = Field(ge=0.0)
    reason: Literal["completed", "disconnect", "pause_limit", "manual", "dead"] = "manual"
