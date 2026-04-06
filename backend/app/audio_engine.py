from __future__ import annotations

import math
import random
import struct
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy import signal


def calculate_contribution(listened_seconds: float, total_duration: float) -> float:
    if total_duration <= 0:
        return 0.0
    progress = max(0.0, min(1.0, listened_seconds / total_duration))
    if progress < 0.05:
        return 0.0
    return progress**1.3


def calculate_intensity(total_damage: float) -> float:
    return 1.0 - math.exp(-0.5 * total_damage)


def calculate_display_integrity(total_damage: float) -> float:
    return max(0.0, 1.0 - _destruction_intensity(total_damage))


def mutate_audio_file(audio_path: Path, total_damage: float) -> bool:
    try:
        audio, sample_rate = sf.read(audio_path, always_2d=True, dtype="float32")
    except RuntimeError:
        return False

    if audio.size == 0:
        return False

    intensity = _destruction_intensity(total_damage)
    audio = _reduce_bit_depth(audio, intensity)
    audio, sample_rate = _degrade_sample_rate(audio, sample_rate, intensity)
    audio = _delete_random_chunks(audio, intensity)
    audio = np.clip(audio, -1.0, 1.0).astype("float32")

    sf.write(audio_path, audio, sample_rate, subtype="PCM_16")
    _corrupt_pcm_data(audio_path, total_damage)
    return is_audio_alive(audio_path)


def is_audio_alive(audio_path: Path) -> bool:
    try:
        audio, _ = sf.read(audio_path, always_2d=True, dtype="float32")
    except RuntimeError:
        return False

    if audio.size == 0:
        return False

    flat = audio.reshape(-1)
    finite_ratio = float(np.isfinite(flat).mean())
    rms = float(np.sqrt(np.mean(np.square(np.nan_to_num(flat)))))
    zero_like_ratio = float((np.abs(flat) < 1e-4).mean())
    clipped_ratio = float((np.abs(flat) > 0.98).mean())
    silent_run_ratio = _largest_silent_run_ratio(flat)

    if finite_ratio < 0.95:
        return False
    if rms < 0.0005:
        return False
    if zero_like_ratio > 0.995:
        return False
    if clipped_ratio > 0.995:
        return False
    if silent_run_ratio > 0.9:
        return False
    return True


def _reduce_bit_depth(audio: np.ndarray, intensity: float) -> np.ndarray:
    target_bits = max(10, int(round(16 - (6 * intensity))))
    levels = float((2**target_bits) - 1)
    return np.round(((audio + 1.0) * 0.5) * levels) / levels * 2.0 - 1.0


def _degrade_sample_rate(audio: np.ndarray, sample_rate: int, intensity: float) -> tuple[np.ndarray, int]:
    factor = max(1, int(round(1 + intensity * 2)))
    degraded_rate = max(16000, sample_rate // factor)
    if degraded_rate == sample_rate:
        return audio, sample_rate

    down = signal.resample_poly(audio, up=degraded_rate, down=sample_rate, axis=0)
    restored = signal.resample_poly(down, up=sample_rate, down=degraded_rate, axis=0)
    if restored.shape[0] < audio.shape[0]:
        padding = np.zeros((audio.shape[0] - restored.shape[0], restored.shape[1]), dtype=restored.dtype)
        restored = np.vstack([restored, padding])
    return restored[: audio.shape[0]], sample_rate


def _delete_random_chunks(audio: np.ndarray, intensity: float) -> np.ndarray:
    if intensity <= 0.12:
        return audio

    chunk_count = max(1, int(round(intensity * 4)))
    max_chunk = max(16, int(audio.shape[0] * (0.0002 + intensity * 0.0012)))
    working = audio.copy()
    for _ in range(chunk_count):
        if working.shape[0] < 128:
            break
        chunk_size = random.randint(8, min(max_chunk, max(8, working.shape[0] // 12)))
        start = random.randint(0, max(0, working.shape[0] - chunk_size))
        if random.random() < 0.9:
            working[start : start + chunk_size] = 0.0
        else:
            working = np.concatenate([working[:start], working[start + chunk_size :]], axis=0)
    if working.shape[0] < audio.shape[0]:
        padding = np.zeros((audio.shape[0] - working.shape[0], audio.shape[1]), dtype=working.dtype)
        working = np.vstack([working, padding])
    return working[: audio.shape[0]]


def _corrupt_pcm_data(audio_path: Path, total_damage: float) -> None:
    if total_damage <= 120.0:
        return

    corruption_intensity = 1.0 - math.exp(-0.01 * (total_damage - 120.0))
    flip_rate = 0.000001 + (0.0002 * corruption_intensity)
    raw = bytearray(audio_path.read_bytes())
    data_offset, data_length = _locate_wav_data(raw)
    if data_offset is None or data_length <= 0:
        return

    flips = max(1, int(data_length * flip_rate))
    end = data_offset + data_length
    for _ in range(flips):
        index = random.randrange(data_offset, end)
        mask = 1 << random.randint(0, 7)
        raw[index] ^= mask
    audio_path.write_bytes(bytes(raw))


def _locate_wav_data(raw: bytearray) -> tuple[int | None, int]:
    if raw[:4] != b"RIFF" or raw[8:12] != b"WAVE":
        return None, 0

    cursor = 12
    total = len(raw)
    while cursor + 8 <= total:
        chunk_id = raw[cursor : cursor + 4]
        chunk_size = struct.unpack("<I", raw[cursor + 4 : cursor + 8])[0]
        data_start = cursor + 8
        if chunk_id == b"data":
            bounded = min(chunk_size, total - data_start)
            return data_start, bounded
        cursor = data_start + chunk_size + (chunk_size % 2)
    return None, 0


def _destruction_intensity(total_damage: float) -> float:
    # Stretch the destruction curve so the file can survive many more sessions.
    scaled_damage = total_damage / 220.0
    return 1.0 - math.exp(-0.9 * scaled_damage)


def _largest_silent_run_ratio(flat: np.ndarray) -> float:
    silent = np.abs(flat) < 1e-5
    longest = 0
    current = 0
    for sample_is_silent in silent:
      if sample_is_silent:
          current += 1
          if current > longest:
              longest = current
      else:
          current = 0
    return float(longest / max(1, flat.size))
