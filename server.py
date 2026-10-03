import asyncio
import io
import json
import logging
import os
import socket
import struct
import sys
import wave
from typing import Set

# Ensure UTF-8 output on Windows console
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

import numpy as np
import speech_recognition as sr
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("SmartCapServer")

app = FastAPI(title="Smart Cap Futuristic 3D Audio & STT Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Active connected web clients and ESP32 clients
web_clients: Set[WebSocket] = set()
esp32_clients: Set[WebSocket] = set()

class AppState:
    current_language = "hi-IN"
    is_processing_stt = False
    esp32_audio_buffer = bytearray()

app_state = AppState()
recognizer = sr.Recognizer()
recognizer.energy_threshold = 300
recognizer.dynamic_energy_threshold = True

# ESP32 Audio Buffer for STT
# Audio specs: 16000 Hz, 16-bit signed PCM, Mono
SAMPLE_RATE = 16000
BYTES_PER_SAMPLE = 2  # 16-bit
CHANNELS = 1
BUFFER_SECONDS_THRESHOLD = 3.0  # Process STT every ~3 seconds or on silence
MIN_SPEECH_DURATION = 0.8


def get_local_ip() -> str:
    """Find local network IPv4 address."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DATA if hasattr(socket, "SOCK_DATA") else socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


LOCAL_IP = get_local_ip()
PORT = 8000


async def broadcast_to_web(message: dict):
    """Send JSON message to all connected web browser frontends."""
    if not web_clients:
        return
    payload = json.dumps(message)
    dead_clients = set()
    for client in list(web_clients):
        try:
            await client.send_text(payload)
        except Exception:
            dead_clients.add(client)
    for dc in dead_clients:
        web_clients.discard(dc)


def compute_frequencies(pcm_data: bytes, sample_rate=16000, num_bins=32):
    """Calculate FFT frequency bands (0-100 scale) for visualizer."""
    if len(pcm_data) < 256:
        return [0] * num_bins, 0.0, -60.0
    try:
        # Convert 16-bit PCM bytes to numpy array
        samples = np.frombuffer(pcm_data, dtype=np.int16).astype(np.float32)
        if len(samples) == 0:
            return [0] * num_bins, 0.0, -60.0

        # Normalize
        samples = samples / 32768.0

        # Calculate RMS energy / volume
        rms = float(np.sqrt(np.mean(samples**2)))
        db = float(20 * np.log10(rms + 1e-6))

        # FFT
        fft_vals = np.abs(np.fft.rfft(samples))
        bands = []
        step = max(1, len(fft_vals) // num_bins)
        for i in range(num_bins):
            chunk = fft_vals[i * step : (i + 1) * step]
            if len(chunk) > 0:
                val = float(np.mean(chunk))
                scaled = min(100.0, val * 15.0)
                bands.append(round(scaled, 1))
            else:
                bands.append(0.0)

        return bands, round(rms, 4), round(db, 1)
    except Exception as e:
        logger.debug(f"FFT error: {e}")
        return [0] * num_bins, 0.0, -60.0


def process_audio_buffer_stt(pcm_bytes: bytes, lang: str):
    """Run Google Speech Recognition on accumulated PCM audio in a background thread."""
    if len(pcm_bytes) < int(SAMPLE_RATE * BYTES_PER_SAMPLE * MIN_SPEECH_DURATION):
        return None

    try:
        # Build in-memory WAV file
        wav_io = io.BytesIO()
        with wave.open(wav_io, "wb") as wav_file:
            wav_file.setnchannels(CHANNELS)
            wav_file.setsampwidth(BYTES_PER_SAMPLE)
            wav_file.setframerate(SAMPLE_RATE)
            wav_file.writeframes(pcm_bytes)
        wav_io.seek(0)

        with sr.AudioFile(wav_io) as source:
            audio_data = recognizer.record(source)

        # Transcribe using Google's Web Speech API
        text = recognizer.recognize_google(audio_data, language=lang)
        return text
    except sr.UnknownValueError:
        return None
    except sr.RequestError as e:
        logger.warning(f"Google STT service error: {e}")
        return None
    except Exception as e:
        logger.error(f"STT processing exception: {e}")
        return None


@app.get("/api/info")
async def get_server_info():
    """Return local IP and connection URLs for ESP32 and web browser."""
    return JSONResponse({
        "local_ip": LOCAL_IP,
        "port": PORT,
        "http_url": f"http://{LOCAL_IP}:{PORT}",
        "ws_esp32_url": f"ws://{LOCAL_IP}:{PORT}/ws/esp32",
        "ws_web_url": f"ws://{LOCAL_IP}:{PORT}/ws/web",
        "current_language": app_state.current_language,
        "esp32_connected": len(esp32_clients) > 0,
        "sample_rate": SAMPLE_RATE,
    })


@app.post("/api/language")
async def set_language(payload: dict):
    """Change recognition language (e.g. 'hi-IN', 'en-IN', 'en-US')."""
    new_lang = payload.get("language", "hi-IN")
    app_state.current_language = new_lang
    await broadcast_to_web({
        "type": "language_changed",
        "language": app_state.current_language,
    })
    return {"status": "ok", "language": app_state.current_language}


@app.websocket("/ws/web")
async def websocket_web_endpoint(websocket: WebSocket):
    """WebSocket connection for Browser Frontend."""
    await websocket.accept()
    web_clients.add(websocket)
    logger.info(f"Frontend browser connected. Total browsers: {len(web_clients)}")

    await websocket.send_text(
        json.dumps({
            "type": "welcome",
            "local_ip": LOCAL_IP,
            "port": PORT,
            "ws_esp32_url": f"ws://{LOCAL_IP}:{PORT}/ws/esp32",
            "esp32_connected": len(esp32_clients) > 0,
            "current_language": app_state.current_language,
        })
    )

    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            action = msg.get("action")

            if action == "set_language":
                app_state.current_language = msg.get("language", "hi-IN")
                await broadcast_to_web({
                    "type": "language_changed",
                    "language": app_state.current_language,
                })
            elif action == "browser_transcript":
                await broadcast_to_web({
                    "type": "transcript",
                    "text": msg.get("text", ""),
                    "source": "browser_mic",
                    "language": app_state.current_language,
                    "confidence": msg.get("confidence", 1.0),
                })
            elif action == "browser_frequencies":
                await broadcast_to_web({
                    "type": "frequency_data",
                    "source": "browser_mic",
                    "bands": msg.get("bands", []),
                    "rms": msg.get("rms", 0),
                    "db": msg.get("db", -60),
                })
    except WebSocketDisconnect:
        web_clients.discard(websocket)
        logger.info("Frontend browser disconnected.")
    except Exception as e:
        web_clients.discard(websocket)
        logger.error(f"Error on web websocket: {e}")


@app.websocket("/ws/esp32")
async def websocket_esp32_endpoint(websocket: WebSocket):
    """WebSocket connection for ESP32 with digital microphone."""
    await websocket.accept()
    esp32_clients.add(websocket)
    client_host = websocket.client.host if websocket.client else "ESP32"
    logger.info(f"🟢 ESP32 connected from {client_host}! Total ESP32s: {len(esp32_clients)}")

    await broadcast_to_web({
        "type": "esp32_status",
        "connected": True,
        "ip": client_host,
    })

    bytes_accumulated_for_fft = bytearray()

    try:
        while True:
            message = await websocket.receive()
            if "bytes" in message and message["bytes"]:
                chunk = message["bytes"]
                app_state.esp32_audio_buffer.extend(chunk)
                bytes_accumulated_for_fft.extend(chunk)

                # Send FFT updates to browser every ~2048 bytes (approx 64ms)
                if len(bytes_accumulated_for_fft) >= 2048:
                    bands, rms, db = compute_frequencies(
                        bytes(bytes_accumulated_for_fft), sample_rate=SAMPLE_RATE, num_bins=32
                    )
                    bytes_accumulated_for_fft.clear()
                    await broadcast_to_web({
                        "type": "frequency_data",
                        "source": "esp32",
                        "bands": bands,
                        "rms": rms,
                        "db": db,
                    })

                # Check if buffer reached threshold for Speech-to-Text
                max_bytes = int(SAMPLE_RATE * BYTES_PER_SAMPLE * BUFFER_SECONDS_THRESHOLD)
                if len(app_state.esp32_audio_buffer) >= max_bytes and not app_state.is_processing_stt:
                    app_state.is_processing_stt = True
                    audio_to_process = bytes(app_state.esp32_audio_buffer)
                    app_state.esp32_audio_buffer.clear()

                    loop = asyncio.get_event_loop()
                    text = await loop.run_in_executor(
                        None, process_audio_buffer_stt, audio_to_process, app_state.current_language
                    )
                    app_state.is_processing_stt = False

                    if text:
                        logger.info(f"🎤 [ESP32 STT Result]: {text}")
                        await broadcast_to_web({
                            "type": "transcript",
                            "text": text,
                            "source": "esp32",
                            "language": app_state.current_language,
                            "confidence": 0.95,
                        })

            elif "text" in message and message["text"]:
                try:
                    payload = json.loads(message["text"])
                    logger.info(f"ESP32 JSON payload: {payload}")
                    await broadcast_to_web({
                        "type": "esp32_telemetry",
                        "data": payload,
                    })
                except Exception:
                    pass

    except WebSocketDisconnect:
        esp32_clients.discard(websocket)
        logger.info(f"🔴 ESP32 disconnected from {client_host}")
        await broadcast_to_web({
            "type": "esp32_status",
            "connected": len(esp32_clients) > 0,
            "ip": None,
        })
    except Exception as e:
        esp32_clients.discard(websocket)
        logger.error(f"Error on ESP32 websocket: {e}")
        await broadcast_to_web({
            "type": "esp32_status",
            "connected": len(esp32_clients) > 0,
            "ip": None,
        })


app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
async def serve_index():
    if os.path.exists("index.html"):
        return FileResponse("index.html")
    return FileResponse("static/index.html")


@app.get("/style.css")
async def serve_css():
    if os.path.exists("style.css"):
        return FileResponse("style.css", media_type="text/css")
    return FileResponse("static/style.css", media_type="text/css")


@app.get("/app.js")
async def serve_js():
    if os.path.exists("app.js"):
        return FileResponse("app.js", media_type="application/javascript")
    return FileResponse("static/app.js", media_type="application/javascript")


if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("[*] SMART CAP - 3D AUDIO VISUALIZER & ESP32 STT SERVER")
    print("=" * 60)
    print(f"[*] Localhost Browser URL : http://localhost:{PORT}")
    print(f"[*] Network Browser URL   : http://{LOCAL_IP}:{PORT}")
    print(f"[*] ESP32 WebSocket URL   : ws://{LOCAL_IP}:{PORT}/ws/esp32")
    print("=" * 60 + "\n")
    uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="info")
