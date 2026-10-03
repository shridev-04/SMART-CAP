import base64
import io
import time
import wave
from typing import List, Optional

import numpy as np
import speech_recognition as sr
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

app = FastAPI(title="Smart Cap Vercel Cloud Audio API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global in-memory cloud state
class CloudState:
    current_language = "hi-IN"
    last_transcript = ""
    last_source = "esp32_cloud"
    last_timestamp = 0
    history: List[dict] = []
    latest_bands = [0] * 32
    latest_rms = 0.0
    latest_db = -60.0
    esp32_last_seen = 0

state = CloudState()
recognizer = sr.Recognizer()
recognizer.energy_threshold = 280

SAMPLE_RATE = 16000
BYTES_PER_SAMPLE = 2
CHANNELS = 1


def compute_frequencies(pcm_data: bytes, sample_rate=16000, num_bins=32):
    """Calculate 32-band FFT frequencies for visualizer."""
    if len(pcm_data) < 256:
        return [0] * num_bins, 0.0, -60.0
    try:
        samples = np.frombuffer(pcm_data, dtype=np.int16).astype(np.float32)
        if len(samples) == 0:
            return [0] * num_bins, 0.0, -60.0

        samples = samples / 32768.0
        rms = float(np.sqrt(np.mean(samples**2)))
        db = float(20 * np.log10(rms + 1e-6))

        fft_vals = np.abs(np.fft.rfft(samples))
        bands = []
        step = max(1, len(fft_vals) // num_bins)
        for i in range(num_bins):
            chunk = fft_vals[i * step : (i + 1) * step]
            if len(chunk) > 0:
                val = float(np.mean(chunk))
                bands.append(round(min(100.0, val * 15.0), 1))
            else:
                bands.append(0.0)

        return bands, round(rms, 4), round(db, 1)
    except Exception:
        return [0] * num_bins, 0.0, -60.0


def transcribe_pcm(pcm_bytes: bytes, lang: str) -> Optional[str]:
    """Transcribe PCM audio bytes with Google STT."""
    try:
        wav_io = io.BytesIO()
        with wave.open(wav_io, "wb") as wav_file:
            wav_file.setnchannels(CHANNELS)
            wav_file.setsampwidth(BYTES_PER_SAMPLE)
            wav_file.setframerate(SAMPLE_RATE)
            wav_file.writeframes(pcm_bytes)
        wav_io.seek(0)

        with sr.AudioFile(wav_io) as source:
            audio_data = recognizer.record(source)

        text = recognizer.recognize_google(audio_data, language=lang)
        return text
    except Exception:
        return None


@app.get("/api/info")
async def get_info(request: Request):
    """Return cloud endpoint details."""
    host = request.headers.get("host", "your-app.vercel.app")
    scheme = "https" if "vercel.app" in host else request.url.scheme
    cloud_url = f"{scheme}://{host}/api/audio"
    
    is_online = (time.time() - state.esp32_last_seen) < 15
    return {
        "status": "online",
        "cloud_url": cloud_url,
        "language": state.current_language,
        "esp32_connected": is_online,
        "timestamp": int(time.time()),
    }


@app.post("/api/language")
async def set_language(payload: dict):
    new_lang = payload.get("language", "hi-IN")
    state.current_language = new_lang
    return {"status": "ok", "language": state.current_language}


@app.post("/api/audio")
async def receive_esp32_audio(request: Request):
    """Direct HTTP POST endpoint for ESP32 to upload audio to Vercel."""
    body = await request.body()
    if not body or len(body) < 512:
        return JSONResponse({"status": "error", "message": "Audio chunk too small"}, status_code=400)

    state.esp32_last_seen = time.time()

    # Calculate FFT frequencies for 3D visualizer
    bands, rms, db = compute_frequencies(body, SAMPLE_RATE, 32)
    state.latest_bands = bands
    state.latest_rms = rms
    state.latest_db = db

    # Perform Speech-to-Text
    text = transcribe_pcm(body, state.current_language)
    if text:
        state.last_transcript = text
        state.last_timestamp = time.time()
        state.history.insert(0, {
            "text": text,
            "source": "ESP32 CLOUD",
            "lang": state.current_language,
            "time": time.strftime("%H:%M:%S"),
        })
        if len(state.history) > 40:
            state.history.pop()

    return {
        "status": "success",
        "transcript": text,
        "bands": bands,
        "rms": rms,
        "db": db,
    }


@app.get("/api/stream")
async def get_stream_updates():
    """Poll endpoint for frontend to receive latest audio frequency and transcripts."""
    is_online = (time.time() - state.esp32_last_seen) < 15
    return {
        "esp32_connected": is_online,
        "latest_transcript": state.last_transcript,
        "last_timestamp": state.last_timestamp,
        "bands": state.latest_bands,
        "rms": state.latest_rms,
        "db": state.latest_db,
        "history": state.history[:20],
        "language": state.current_language,
    }
