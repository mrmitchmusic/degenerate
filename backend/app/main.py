from __future__ import annotations

import asyncio
import os
import time
import uuid
from collections import deque
from dataclasses import dataclass
from pathlib import Path

import soundfile as sf
from fastapi import FastAPI, HTTPException, Request
from fastapi import File, Header, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from .audio_engine import calculate_contribution, is_audio_alive, mutate_audio_file
from .models import (
    AdminOverview,
    AdminSessionInfo,
    BrowserSessionPayload,
    EndSessionPayload,
    GlobalState,
    HeartbeatPayload,
    OpenSessionPayload,
    SessionOpenResponse,
    SessionSnapshot,
)
from .state import PersistentState


BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = Path(os.getenv("MITCH_OS_88_DATA_DIR", str(BASE_DIR / "data"))).resolve()
ALLOWED_ORIGINS = [origin.strip() for origin in os.getenv("MITCH_OS_88_ALLOWED_ORIGINS", "*").split(",") if origin.strip()]
ALLOWED_ORIGIN_REGEX = os.getenv("MITCH_OS_88_ALLOWED_ORIGIN_REGEX", r"^https://.*\.vercel\.app$")
ADMIN_TOKEN = os.getenv("MITCH_OS_88_ADMIN_TOKEN", "").strip()


@dataclass
class SessionRecord:
    session_id: str
    browser_session_id: str
    created_at: float
    queue_entered_at: float
    ip_address: str | None = None
    status: str = "queued"
    listened_seconds: float = 0.0
    paused_seconds: float = 0.0
    started_at: float | None = None
    last_heartbeat: float | None = None
    is_paused: bool = False
    finalized: bool = False


class MitchOs88Service:
    def __init__(self) -> None:
        self.state_store = PersistentState(DATA_DIR)
        self.state_store.ensure_seed_audio()
        self.state: GlobalState = GlobalState()
        self.admin_stats: dict[str, object] = {"visit_count": 0, "session_count": 0, "seen_browser_session_ids": []}
        self._lock = asyncio.Lock()
        self._queue: deque[str] = deque()
        self._sessions: dict[str, SessionRecord] = {}
        self._stale_task: asyncio.Task[None] | None = None

    async def start(self) -> None:
        self.state = await self.state_store.load()
        self.admin_stats = await self.state_store.load_admin_stats()
        self._stale_task = asyncio.create_task(self._expire_stale_sessions())

    async def stop(self) -> None:
        if self._stale_task:
            self._stale_task.cancel()
            try:
                await self._stale_task
            except asyncio.CancelledError:
                pass

    async def record_visit(self, browser_session_id: str) -> int:
        async with self._lock:
            seen_ids = set(str(item) for item in self.admin_stats.get("seen_browser_session_ids", []))
            if browser_session_id and browser_session_id not in seen_ids:
                seen_ids.add(browser_session_id)
                self.admin_stats["seen_browser_session_ids"] = sorted(seen_ids)
                self.admin_stats["visit_count"] = len(seen_ids)
                self.admin_stats = await self.state_store.save_admin_stats(self.admin_stats)
            return int(self.admin_stats.get("visit_count", 0))

    async def open_session(self, browser_session_id: str, ip_address: str | None = None) -> SessionSnapshot:
        async with self._lock:
            for record in self._sessions.values():
                if (
                    record.browser_session_id == browser_session_id
                    and not record.finalized
                    and record.status != "ended"
                ):
                    record.ip_address = ip_address or record.ip_address
                    if record.status != "active":
                        self._ensure_session_queued_locked(record.session_id)
                    self._promote_next_locked()
                    return self._snapshot_locked(record.session_id)

            session_id = uuid.uuid4().hex
            now = time.time()
            record = SessionRecord(
                session_id=session_id,
                browser_session_id=browser_session_id,
                created_at=now,
                queue_entered_at=now,
                ip_address=ip_address,
            )
            self._sessions[session_id] = record
            self._ensure_session_queued_locked(session_id)
            self._promote_next_locked()
            return self._snapshot_locked(session_id)

    async def get_session(
        self,
        session_id: str,
        browser_session_id: str | None = None,
        ip_address: str | None = None,
    ) -> SessionSnapshot:
        async with self._lock:
            record = self._require_owned_session_locked(session_id, browser_session_id)
            record.ip_address = ip_address or record.ip_address
            self._promote_next_locked()
            return self._snapshot_locked(session_id)

    async def heartbeat(
        self,
        session_id: str,
        browser_session_id: str,
        payload: HeartbeatPayload,
        ip_address: str | None = None,
    ) -> SessionSnapshot:
        async with self._lock:
            record = self._require_owned_session_locked(session_id, browser_session_id)
            record.ip_address = ip_address or record.ip_address
            if record.status == "ended":
                return self._snapshot_locked(session_id)
            if not record.status == "active":
                return self._snapshot_locked(session_id)

            record.listened_seconds = max(record.listened_seconds, payload.listened_seconds)
            record.paused_seconds = max(record.paused_seconds, payload.paused_seconds)
            record.is_paused = payload.is_paused
            record.last_heartbeat = time.time()

            if record.paused_seconds > 30.0:
                await self._finalize_session_locked(record, "pause_limit")
            return self._snapshot_locked(session_id)

    async def end_session(
        self,
        session_id: str,
        browser_session_id: str,
        payload: EndSessionPayload,
        ip_address: str | None = None,
    ) -> SessionSnapshot:
        async with self._lock:
            record = self._require_owned_session_locked(session_id, browser_session_id)
            record.ip_address = ip_address or record.ip_address
            if record.status != "active":
                return self._snapshot_locked(session_id)
            if record.status != "ended":
                record.listened_seconds = max(record.listened_seconds, payload.listened_seconds)
                record.paused_seconds = max(record.paused_seconds, payload.paused_seconds)
                await self._finalize_session_locked(record, payload.reason)
            return self._snapshot_locked(session_id)

    async def global_state(self) -> GlobalState:
        self.state = await self.state_store.load()
        return self.state

    async def replace_audio_upload(self, upload: UploadFile) -> GlobalState:
        safe_name = Path(upload.filename or "uploaded.wav").name
        if Path(safe_name).suffix.lower() != ".wav":
            raise HTTPException(status_code=400, detail="Only WAV files are supported")

        temp_path = self.state_store.data_dir / f".upload-{uuid.uuid4().hex}.wav"
        try:
            contents = await upload.read()
            if not contents:
                raise HTTPException(status_code=400, detail="Uploaded file is empty")
            temp_path.write_bytes(contents)
            try:
                info = sf.info(temp_path)
            except RuntimeError as error:
                raise HTTPException(status_code=400, detail="Uploaded file is not a valid WAV") from error

            if info.frames <= 0 or info.duration <= 0:
                raise HTTPException(status_code=400, detail="Uploaded WAV has no playable audio")

            async with self._lock:
                self._queue.clear()
                self._sessions.clear()
                self.state = self.state_store.replace_audio(temp_path, safe_name)
                return self.state
        finally:
            await upload.close()
            temp_path.unlink(missing_ok=True)

    async def admin_overview(self) -> AdminOverview:
        async with self._lock:
            self.state = await self.state_store.load()
            self.admin_stats = await self.state_store.load_admin_stats()
            active_record = self._active_session_locked()
            queue_items = [
                self._admin_session_info_locked(record, index + 1)
                for index, session_id in enumerate(self._queue)
                if (record := self._sessions.get(session_id)) is not None and not record.finalized and record.status != "ended"
            ]
            active_info = self._admin_session_info_locked(active_record, 0) if active_record is not None else None
            return AdminOverview(
                state=self.state,
                visit_count=int(self.admin_stats.get("visit_count", 0)),
                session_count=int(self.admin_stats.get("session_count", 0)),
                active_session=active_info,
                queue=queue_items,
            )

    async def _finalize_session_locked(self, record: SessionRecord, reason: str) -> None:
        if record.finalized:
            return
        record.finalized = True
        record.status = "ended"
        try:
            self._queue.remove(record.session_id)
        except ValueError:
            pass

        self.state = await self.state_store.load()
        contribution = calculate_contribution(record.listened_seconds, self.state.duration_seconds)
        self.state.total_damage += contribution
        self.state.play_count += contribution
        self.admin_stats["session_count"] = int(self.admin_stats.get("session_count", 0)) + 1
        self.admin_stats = await self.state_store.save_admin_stats(self.admin_stats)

        if self.state.status == "alive":
            alive = mutate_audio_file(self.state_store.audio_path, self.state.total_damage)
            if not alive or not is_audio_alive(self.state_store.audio_path):
                self.state.status = "dead"

        if reason == "dead":
            self.state.status = "dead"

        self.state = await self.state_store.save(self.state)
        self._promote_next_locked()

    async def _expire_stale_sessions(self) -> None:
        while True:
            await asyncio.sleep(3)
            async with self._lock:
                now = time.time()
                stale_ids: list[str] = []
                for session_id, record in self._sessions.items():
                    if record.status != "active" or record.finalized:
                        continue
                    if record.last_heartbeat and (now - record.last_heartbeat) > 10:
                        stale_ids.append(session_id)
                for session_id in stale_ids:
                    await self._finalize_session_locked(self._sessions[session_id], "disconnect")

    def _require_session_locked(self, session_id: str) -> SessionRecord:
        record = self._sessions.get(session_id)
        if record is None:
            raise HTTPException(status_code=404, detail="Session not found")
        return record

    def _require_owned_session_locked(self, session_id: str, browser_session_id: str | None) -> SessionRecord:
        record = self._require_session_locked(session_id)
        if browser_session_id and record.browser_session_id != browser_session_id:
            raise HTTPException(status_code=403, detail="Session does not belong to this browser")
        return record

    def _ensure_session_queued_locked(self, session_id: str) -> None:
        record = self._sessions.get(session_id)
        if record is None or record.finalized or record.status in {"active", "ended"}:
            return
        if session_id in self._queue:
            return
        self._queue.append(session_id)

    def _active_session_locked(self) -> SessionRecord | None:
        return next((record for record in self._sessions.values() if record.status == "active" and not record.finalized), None)

    def _promote_next_locked(self) -> None:
        if self.state.status == "dead":
            return
        active_record = self._active_session_locked()
        if active_record is not None:
            try:
                self._queue.remove(active_record.session_id)
            except ValueError:
                pass
            return
        while self._queue:
            next_id = self._queue[0]
            record = self._sessions.get(next_id)
            if record is None or record.finalized or record.status == "ended":
                self._queue.popleft()
                continue
            self._queue.popleft()
            record.status = "active"
            record.started_at = time.time()
            record.last_heartbeat = time.time()
            return

    def _snapshot_locked(self, session_id: str) -> SessionSnapshot:
        record = self._require_session_locked(session_id)
        if record.status == "active":
            return SessionSnapshot(
                session_id=record.session_id,
                queue_position=0,
                is_active=self.state.status == "alive",
                status="active",
                listened_seconds=record.listened_seconds,
                paused_seconds=record.paused_seconds,
                started_at=record.started_at,
                last_heartbeat=record.last_heartbeat,
                estimated_wait_seconds=0.0,
            )

        queue_list = [queued_id for queued_id in self._queue if queued_id in self._sessions and not self._sessions[queued_id].finalized]
        queue_position = 0
        if record.status != "ended" and session_id in queue_list:
            queue_position = queue_list.index(session_id) + 1

        estimated_wait = 0.0
        if record.status == "queued":
            active = next((item for item in self._sessions.values() if item.status == "active" and not item.finalized), None)
            remaining = max(0.0, self.state.duration_seconds - active.listened_seconds) if active else 0.0
            estimated_wait = remaining + max(0.0, (queue_position - 2) * self.state.duration_seconds)

        return SessionSnapshot(
            session_id=record.session_id,
            queue_position=queue_position,
            is_active=record.status == "active" and self.state.status == "alive",
            status="ended" if record.status == "ended" else ("active" if record.status == "active" else "queued"),
            listened_seconds=record.listened_seconds,
            paused_seconds=record.paused_seconds,
            started_at=record.started_at,
            last_heartbeat=record.last_heartbeat,
            estimated_wait_seconds=estimated_wait,
        )

    def _admin_session_info_locked(self, record: SessionRecord | None, queue_position: int) -> AdminSessionInfo | None:
        if record is None:
            return None
        return AdminSessionInfo(
            session_id=record.session_id,
            browser_session_id=record.browser_session_id,
            status="ended" if record.status == "ended" else ("active" if record.status == "active" else "queued"),
            queue_position=queue_position,
            ip_address=record.ip_address,
            listened_seconds=record.listened_seconds,
            paused_seconds=record.paused_seconds,
            created_at=record.created_at,
            started_at=record.started_at,
            last_heartbeat=record.last_heartbeat,
        )


service = MitchOs88Service()
app = FastAPI(title="Mitch OS 88")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS if ALLOWED_ORIGINS else ["*"],
    allow_origin_regex=ALLOWED_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup() -> None:
    await service.start()


@app.on_event("shutdown")
async def on_shutdown() -> None:
    await service.stop()


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/admin/status")
async def admin_status() -> dict[str, bool]:
    return {"upload_enabled": bool(ADMIN_TOKEN)}


def _require_admin_token(admin_token: str | None) -> None:
    if not ADMIN_TOKEN:
        raise HTTPException(status_code=503, detail="Admin access is disabled until MITCH_OS_88_ADMIN_TOKEN is configured")
    if admin_token != ADMIN_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid admin token")


@app.get("/state", response_model=GlobalState)
async def get_state() -> GlobalState:
    return await service.global_state()


@app.post("/session/open", response_model=SessionOpenResponse)
async def open_session(payload: OpenSessionPayload, request: Request) -> SessionOpenResponse:
    browser_session_id = payload.resolved_browser_session_id()
    if not browser_session_id:
        raise HTTPException(status_code=400, detail="browser_session_id is required")
    session = await service.open_session(browser_session_id, request.client.host if request.client else None)
    state = await service.global_state()
    return SessionOpenResponse(session=session, state=state)


@app.post("/visit")
async def record_visit(payload: BrowserSessionPayload) -> dict[str, int]:
    browser_session_id = payload.resolved_browser_session_id()
    if not browser_session_id:
        raise HTTPException(status_code=400, detail="browser_session_id is required")
    visit_count = await service.record_visit(browser_session_id)
    return {"visit_count": visit_count}


@app.get("/session/{session_id}", response_model=SessionSnapshot)
async def get_session(
    session_id: str,
    browser_session_id: str | None = Header(default=None, alias="X-Browser-Session-Id"),
    request: Request = None,
) -> SessionSnapshot:
    return await service.get_session(session_id, browser_session_id, request.client.host if request and request.client else None)


@app.post("/session/{session_id}/heartbeat", response_model=SessionSnapshot)
async def heartbeat(
    session_id: str,
    payload: HeartbeatPayload,
    browser_session_id: str | None = Header(default=None, alias="X-Browser-Session-Id"),
    request: Request = None,
) -> SessionSnapshot:
    if not browser_session_id:
        raise HTTPException(status_code=400, detail="X-Browser-Session-Id header is required")
    return await service.heartbeat(session_id, browser_session_id, payload, request.client.host if request and request.client else None)


@app.post("/session/{session_id}/end", response_model=SessionSnapshot)
async def end_session(
    session_id: str,
    payload: EndSessionPayload,
    browser_session_id: str | None = Header(default=None, alias="X-Browser-Session-Id"),
    request: Request = None,
) -> SessionSnapshot:
    if not browser_session_id:
        raise HTTPException(status_code=400, detail="X-Browser-Session-Id header is required")
    return await service.end_session(session_id, browser_session_id, payload, request.client.host if request and request.client else None)


@app.get("/audio/current")
async def current_audio(
    session: str,
    browser_session_id: str | None = None,
    browser_session_id_header: str | None = Header(default=None, alias="X-Browser-Session-Id"),
) -> FileResponse:
    owner_browser_session_id = browser_session_id or browser_session_id_header
    if not owner_browser_session_id:
        raise HTTPException(status_code=400, detail="browser_session_id is required")
    state = await service.global_state()
    if state.status == "dead":
        raise HTTPException(status_code=410, detail="Audio file is dead")
    snapshot = await service.get_session(session, owner_browser_session_id)
    if not snapshot.is_active:
        raise HTTPException(status_code=423, detail="Session is not active")
    return FileResponse(service.state_store.audio_path, media_type="audio/wav", filename=state.filename)


@app.post("/admin/upload", response_model=GlobalState)
async def upload_audio(
    file: UploadFile = File(...),
    admin_token: str | None = Header(default=None, alias="X-Admin-Token"),
) -> GlobalState:
    _require_admin_token(admin_token)
    return await service.replace_audio_upload(file)


@app.get("/admin/overview", response_model=AdminOverview)
async def get_admin_overview(
    admin_token: str | None = Header(default=None, alias="X-Admin-Token"),
) -> AdminOverview:
    _require_admin_token(admin_token)
    return await service.admin_overview()
