from __future__ import annotations

import asyncio
import json
import shutil
from pathlib import Path

import soundfile as sf

from .audio_engine import calculate_display_integrity
from .models import GlobalState


class PersistentState:
    def __init__(self, data_dir: Path) -> None:
        self.data_dir = data_dir
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.state_path = self.data_dir / "state.json"
        self.admin_stats_path = self.data_dir / "admin_stats.json"
        self.audio_path = self.data_dir / "mitch_os_88_master.wav"
        self._lock = asyncio.Lock()

    async def load(self) -> GlobalState:
        async with self._lock:
            state = self._read_state_file()
            return self._sync_audio_metadata(state)

    async def save(self, state: GlobalState) -> GlobalState:
        async with self._lock:
            state = self._sync_audio_metadata(state)
            self.state_path.write_text(json.dumps(state.model_dump(), indent=2))
            return state

    async def load_admin_stats(self) -> dict[str, object]:
        async with self._lock:
            return self._read_admin_stats_file()

    async def save_admin_stats(self, stats: dict[str, object]) -> dict[str, object]:
        async with self._lock:
            normalized = self._normalize_admin_stats(stats)
            self.admin_stats_path.write_text(json.dumps(normalized, indent=2))
            return normalized

    def ensure_seed_audio(self) -> None:
        if self.audio_path.exists():
            if not self.state_path.exists():
                seeded = self._sync_audio_metadata(GlobalState(filename=self.audio_path.name))
                self.state_path.write_text(json.dumps(seeded.model_dump(), indent=2))
            if not self.admin_stats_path.exists():
                self.admin_stats_path.write_text(json.dumps(self._default_admin_stats(), indent=2))
            return

        import numpy as np

        sample_rate = 44100
        duration = 24.0
        timeline = np.linspace(0.0, duration, int(sample_rate * duration), endpoint=False)
        carriers = (
            0.38 * np.sin(2 * np.pi * 220.0 * timeline)
            + 0.26 * np.sin(2 * np.pi * 330.0 * timeline)
            + 0.18 * np.sin(2 * np.pi * 440.0 * timeline)
        )
        pulse = 0.12 * np.sign(np.sin(2 * np.pi * 1.5 * timeline))
        envelope = np.linspace(1.0, 0.55, timeline.size)
        stereo = np.column_stack([(carriers + pulse) * envelope, (carriers - pulse) * envelope])
        sf.write(self.audio_path, stereo.astype("float32"), sample_rate, subtype="PCM_16")
        seeded = self._sync_audio_metadata(GlobalState(filename=self.audio_path.name))
        self.state_path.write_text(json.dumps(seeded.model_dump(), indent=2))
        if not self.admin_stats_path.exists():
            self.admin_stats_path.write_text(json.dumps(self._default_admin_stats(), indent=2))

    def replace_audio(self, source_path: Path, original_filename: str) -> GlobalState:
        shutil.copyfile(source_path, self.audio_path)
        fresh_state = self._sync_audio_metadata(GlobalState(filename=original_filename))
        self.state_path.write_text(json.dumps(fresh_state.model_dump(), indent=2))
        return fresh_state

    def _read_state_file(self) -> GlobalState:
        if not self.state_path.exists():
            seeded = self._sync_audio_metadata(GlobalState(filename=self.audio_path.name))
            self.state_path.write_text(json.dumps(seeded.model_dump(), indent=2))
            return seeded
        return GlobalState.model_validate_json(self.state_path.read_text())

    def _read_admin_stats_file(self) -> dict[str, object]:
        if not self.admin_stats_path.exists():
            default_stats = self._default_admin_stats()
            self.admin_stats_path.write_text(json.dumps(default_stats, indent=2))
            return default_stats
        try:
            raw = json.loads(self.admin_stats_path.read_text())
        except json.JSONDecodeError:
            raw = self._default_admin_stats()
        normalized = self._normalize_admin_stats(raw)
        self.admin_stats_path.write_text(json.dumps(normalized, indent=2))
        return normalized

    def _default_admin_stats(self) -> dict[str, object]:
        return {
            "visit_count": 0,
            "session_count": 0,
            "seen_browser_session_ids": [],
        }

    def _normalize_admin_stats(self, stats: dict[str, object]) -> dict[str, object]:
        seen_ids = stats.get("seen_browser_session_ids")
        normalized_ids = [str(item) for item in seen_ids] if isinstance(seen_ids, list) else []
        return {
            "visit_count": max(0, int(stats.get("visit_count", len(normalized_ids)) or 0)),
            "session_count": max(0, int(stats.get("session_count", 0) or 0)),
            "seen_browser_session_ids": normalized_ids,
        }

    def _sync_audio_metadata(self, state: GlobalState) -> GlobalState:
        if not self.audio_path.exists():
            return state
        try:
            info = sf.info(self.audio_path)
            state.duration_seconds = float(info.duration)
            state.sample_rate = int(info.samplerate)
        except RuntimeError:
            state.duration_seconds = 0.0
        state.integrity_percent = max(0.0, min(100.0, 100.0 * calculate_display_integrity(state.total_damage)))
        return state
