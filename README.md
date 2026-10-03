# 🧢 SMART CAP // 3D Futuristic Neural Audio & STT System

Ultra-modern Cyberpunk 3D Website with Real-Time Speech-to-Text (STT), 32-Band Audio Frequency Visualizer, and ESP32 I2S Digital Mic Streamer.

---

## 🌟 Key Features

1. **Cyberpunk 3D Holographic Visualizer**:
   - Built with **Three.js (WebGL)**.
   - 3D Quantum Orb + Floating Particles + Wireframe Mesh reacting to audio frequencies and human voice.
2. **32-Band Real-Time Frequency Spectrum**:
   - Sub-bass (60Hz), Bass (250Hz), Mids (1kHz), Presence (4kHz), Brilliance (16kHz).
   - Oscilloscope waveform with glow trails and decibel (dB) level meter.
3. **Real-Time Speech-to-Text (STT)**:
   - Live spoken words stream directly on screen.
   - Dual language toggle: **Hindi (hi-IN)** & **English (en-IN / en-US)**.
   - Transcript history with timestamp, speaker source badge, and export to `.txt`.
   - Text-to-Speech replay button.
4. **Automatic ESP32 Link Generator**:
   - Auto-detects local host IP and generates ready-to-copy WebSocket link (`ws://<IP>:8000/ws/esp32`).
5. **Dual Operation Modes**:
   - 🎙️ **Laptop/PC Mic Test Mode**: Test immediately on localhost with 0 extra hardware needed!
   - 📡 **ESP32 Live Stream Mode**: Real-time I2S digital mic stream from ESP32 over Wi-Fi.

---

## 🔌 ESP32 + INMP441 Wiring Diagram

| INMP441 Digital Mic Pin | ESP32 Pin | Description |
| :--- | :--- | :--- |
| **VDD** | **3.3V** | Power (⚠️ DO NOT connect to 5V!) |
| **GND** | **GND** | Ground |
| **SD** (Serial Data) | **GPIO 32** | I2S Data Output |
| **WS** (Word Select) | **GPIO 15** | I2S Left/Right Clock (LRCK) |
| **SCK** (Clock) | **GPIO 14** | I2S Bit Clock (BCLK) |
| **L/R** | **GND** | Left Channel Select |

---

## 🚀 Quick Start (Localhost Pe Run Kaise Kare)

### Step 1: Start the Python Backend Server
Open your terminal in this folder and run:
```bash
python server.py
```

Console me aapko links dikhenge:
- 🌐 **Localhost Browser**: `http://localhost:8000`
- 🌐 **Network Browser**: `http://10.21.66.171:8000`
- ⚡ **ESP32 WebSocket**: `ws://10.21.66.171:8000/ws/esp32`

### Step 2: Open Website in Browser
1. Browser me `http://localhost:8000` khole.
2. **"START MIC"** button par click karke browser mic allow kare.
3. Kuch bole (jaise *"Namaste"* ya *"Hello Smart Cap"*):
   - 3D Holographic Orb voice energy ke sath pulsate karega.
   - 32-Band Equalizer aur Oscilloscope frequency wave dikhayenge.
   - Jo bhi aap bolenge wo Live Transcript Box me text ban kar dikhayega!

---

## 📡 ESP32 Code Flash Guide (Arduino IDE)

1. **Arduino IDE** khole.
2. File menu se `esp32_smart_mic/esp32_smart_mic.ino` open kare.
3. **Libraries Install Kare**:
   - `Sketch` -> `Include Library` -> `Manage Libraries...`
   - Search: **WebSockets** (by Markus Sattler) -> Install kare.
4. Code me apna Wi-Fi credentials dale:
   ```cpp
   const char* WIFI_SSID     = "YOUR_WIFI_NAME";
   const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
   const char* SERVER_HOST   = "10.21.66.171"; // Website pe jo IP dikh raha hai
   ```
5. Board select kare: **ESP32 Dev Module**, aur COM port select karke **Upload** kare!
6. ESP32 connect hote hi website par **ESP32: CONNECTED (ONLINE)** ka green indicator aa jayega!

---

## ☁️ Vercel Par Deploy Kaise Kare (Step-by-Step)

Kyunki aapne project already GitHub par upload kar diya hai, Vercel par deploy karna bohot aasan hai:

1. **Vercel me Login kare**:
   - [https://vercel.com](https://vercel.com) open kare aur apne GitHub account se login kare.

2. **New Project Add kare**:
   - Dashboard par **"Add New..."** button par click karke **"Project"** select kare.

3. **GitHub Repository Import kare**:
   - Apni SMART CAP repository ke aage **"Import"** par click kare.

4. **Deploy Settings**:
   - **Framework Preset**: `Other` (Vercel automatically detect kar leta hai).
   - **Root Directory**: `./` (default hi rehne de).
   - **Build Command** aur **Output Directory**: Blank / Default rehne de (`vercel.json` already configured hai).

5. **Deploy Button dabaye**:
   - **"Deploy"** par click kare! 10-15 seconds ke andar aapki website live ho jayegi:
     `https://your-smart-cap.vercel.app`

6. **Vercel Pe Fayde**:
   - **HTTPS Active**: Mobile phone aur doosre laptops par microphone 100% chalega bina kisi setting ke!
   - **Cloud 3D Visualizer & STT**: Three.js 3D visualizer aur Speech-to-Text browser ke andar full 60FPS speed se chalenge!
   - **Custom WebSocket Connect**: Website par upar **"ESP32 WEBSOCKET LINK"** box me apna local IP ya ngrok tunnel link daalkar **"CONNECT"** button daba sakte hain.
