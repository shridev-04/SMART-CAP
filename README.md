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
4. **Automatic Vercel Cloud Link Generator**:
   - Vercel par deploy hone ke baad automatically aapka public cloud endpoint (`https://<your-project>.vercel.app/api/audio`) generate karta hai.
5. **Zero Localhost Dependency**:
   - ESP32 seedha Vercel ke Cloud URL par audio bhejta hai. Laptop ya local server on rakhne ki bilkul zaroorat nahi hai!
6. **Dual Operation Modes**:
   - 🎙️ **Device Mic Mode**: Mobile ya laptop mic se direct 3D visualizer aur Speech-to-Text test karein.
   - 📡 **ESP32 Cloud Stream Mode**: ESP32 se internet ke zariye direct audio stream.

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

## ☁️ Vercel Cloud Par Kaise Use Kare (100% Cloud)

1. Apni website open karein: `https://your-smart-cap.vercel.app`
2. Header me **"ESP32 CLOUD LINK"** me aapko link dikhega:
   `https://your-smart-cap.vercel.app/api/audio`
3. ESP32 ke Arduino code (`esp32_smart_mic.ino`) me ye link daal kar flash karein:
   ```cpp
   const char* VERCEL_API_URL = "https://your-smart-cap.vercel.app/api/audio";
   ```
4. ESP32 ko power bank ya charger se plug karein.
5. Mic me bole — Vercel par real-time text aur 3D frequency visualizer chalega!

---

## 💻 Optional: Local Offline Testing (Bina Internet ke)

Agar bina internet ke apne laptop par offline test karna chahein:
```bash
python server.py
```

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
