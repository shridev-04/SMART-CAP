/**
 * ======================================================================================
 * SMART CAP - ESP32 TO VERCEL CLOUD DIRECT AUDIO STREAMER (NO LOCALHOST NEEDED!)
 * ======================================================================================
 * 
 * Hardware Required:
 * - ESP32 Development Board (ESP-WROOM-32 / DevKit v1)
 * - INMP441 I2S Digital MEMS Microphone Module
 * 
 * INMP441 to ESP32 Pin Connections:
 *   INMP441 Pin     ESP32 Pin     Description
 *   --------------------------------------------------------
 *   VDD             3.3V          Power (DO NOT connect to 5V!)
 *   GND             GND           Ground
 *   SD (Serial Data)GPIO 32       I2S Serial Data Out
 *   WS (Word Select)GPIO 15       I2S Left/Right Clock (LRCK)
 *   SCK (Clock)     GPIO 14       I2S Bit Clock (BCLK)
 *   L/R             GND           Left Channel Selection
 * 
 * Zero Additional Libraries Needed! (Uses built-in ESP32 WiFi & HTTPClient)
 * 
 * How to Flash:
 * 1. Open this file in Arduino IDE.
 * 2. Select Board: "ESP32 Dev Module" or "DOIT ESP32 DEVKIT V1".
 * 3. Update WIFI_SSID and WIFI_PASSWORD below.
 * 4. Paste your Vercel Link into VERCEL_API_URL:
 *    Example: "https://your-smart-cap.vercel.app/api/audio"
 * 5. Click Upload and open Serial Monitor at 115200 baud!
 * ======================================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <driver/i2s.h>

// ---------------- 1. WIFI & VERCEL CLOUD CONFIGURATION ----------------
const char* WIFI_SSID      = "YOUR_WIFI_NAME";       // <-- Enter your WiFi Name / Hotspot
const char* WIFI_PASSWORD  = "YOUR_WIFI_PASSWORD";   // <-- Enter your WiFi Password

// Put your Vercel link here (No Localhost! Direct Cloud URL)
// Website pe jo "ESP32 CLOUD LINK" dikh raha hai usko yahan paste karein:
const char* VERCEL_API_URL = "https://your-smart-cap.vercel.app/api/audio";

// ---------------- 2. I2S DIGITAL MIC CONFIGURATION ----------------
#define I2S_PORT         I2S_NUM_0
#define PIN_I2S_SCK      14   // BCLK
#define PIN_I2S_WS       15   // LRC / WS
#define PIN_I2S_SD       32   // DOUT / SD

#define SAMPLE_RATE      16000
#define DMA_BUF_COUNT    8
#define DMA_BUF_LEN      512

// Record buffer: ~2.5 seconds of audio (16000 samples/sec * 2.5s = 40,000 samples = 80,000 bytes)
#define RECORD_SAMPLES   36000 
int32_t raw_buffer[512];
int16_t* pcm_audio_buffer = NULL;
int recorded_count = 0;

void setupI2S() {
  Serial.println("[I2S] Initializing INMP441 Microphone Driver...");

  const i2s_config_t i2s_config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate = SAMPLE_RATE,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_32BIT,
    .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
    .communication_format = i2s_comm_format_t(I2S_COMM_FORMAT_STAND_I2S),
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count = DMA_BUF_COUNT,
    .dma_buf_len = DMA_BUF_LEN,
    .use_apll = false,
    .tx_desc_auto_clear = false,
    .fixed_mclk = 0
  };

  const i2s_pin_config_t pin_config = {
    .bck_io_num = PIN_I2S_SCK,
    .ws_io_num = PIN_I2S_WS,
    .data_out_num = I2S_PIN_NO_CHANGE,
    .data_in_num = PIN_I2S_SD
  };

  esp_err_t err = i2s_driver_install(I2S_PORT, &i2s_config, 0, NULL);
  if (err != ESP_OK) {
    Serial.printf("[I2S] Driver install failed: %d\n", err);
    return;
  }

  err = i2s_set_pin(I2S_PORT, &pin_config);
  if (err != ESP_OK) {
    Serial.printf("[I2S] Pin configuration failed: %d\n", err);
    return;
  }

  i2s_zero_dma_buffer(I2S_PORT);
  Serial.println("[I2S] Digital Microphone Initialized Successfully!");
}

void connectWiFi() {
  Serial.printf("\n[WiFi] Connecting to %s ", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 40) {
    delay(400);
    Serial.print(".");
    retries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Connected to Internet!");
    Serial.print("[WiFi] ESP32 IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n[WiFi] Connection Failed! Check SSID & Password.");
  }
}

void sendAudioToVercel(uint8_t* data, size_t len) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[Cloud] WiFi disconnected, retrying connection...");
    connectWiFi();
    return;
  }

  WiFiClientSecure client;
  client.setInsecure(); // Allows HTTPS without loading root CA bundle

  HTTPClient https;
  Serial.printf("[Cloud] Posting %d bytes to Vercel: %s\n", len, VERCEL_API_URL);

  if (https.begin(client, VERCEL_API_URL)) {
    https.addHeader("Content-Type", "application/octet-stream");
    https.setTimeout(8000);

    int httpCode = https.POST(data, len);
    if (httpCode > 0) {
      String response = https.getString();
      Serial.printf("[Cloud] Vercel Response (%d): %s\n", httpCode, response.c_str());
    } else {
      Serial.printf("[Cloud] POST Failed, error: %s\n", https.errorToString(httpCode).c_str());
    }
    https.end();
  } else {
    Serial.println("[Cloud] Unable to connect to Vercel!");
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n========================================================");
  Serial.println("  SMART CAP // ESP32 TO VERCEL CLOUD STREAMER  ");
  Serial.println("  (100% CLOUD NATIVE - ZERO LOCALHOST)  ");
  Serial.println("========================================================");

  // Allocate audio buffer in PSRAM/RAM
  pcm_audio_buffer = (int16_t*)malloc(RECORD_SAMPLES * sizeof(int16_t));
  if (!pcm_audio_buffer) {
    Serial.println("[Error] Could not allocate audio buffer!");
    while(1) delay(1000);
  }

  connectWiFi();
  setupI2S();
  Serial.println("[Ready] Speak into microphone! Audio will stream to Vercel.\n");
}

void loop() {
  size_t bytes_read = 0;
  esp_err_t result = i2s_read(I2S_PORT, (void*)raw_buffer, sizeof(raw_buffer), &bytes_read, portMAX_DELAY);

  if (result == ESP_OK && bytes_read > 0) {
    int samples = bytes_read / sizeof(int32_t);

    for (int i = 0; i < samples; i++) {
      if (recorded_count < RECORD_SAMPLES) {
        int32_t sample = raw_buffer[i] >> 14;
        if (sample > 32767) sample = 32767;
        else if (sample < -32768) sample = -32768;
        pcm_audio_buffer[recorded_count++] = (int16_t)sample;
      }
    }

    // When buffer is full (~2.5 seconds of audio), send directly to Vercel!
    if (recorded_count >= RECORD_SAMPLES) {
      Serial.println("[Mic] Buffer full (~2.5s recorded). Sending to Vercel...");
      sendAudioToVercel((uint8_t*)pcm_audio_buffer, RECORD_SAMPLES * sizeof(int16_t));
      recorded_count = 0; // Reset for next speech chunk
    }
  }
}
