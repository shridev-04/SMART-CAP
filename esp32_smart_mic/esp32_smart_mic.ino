/**
 * ======================================================================================
 * SMART CAP // ESP32 + INMP441 DIGITAL MIC AUDIO STREAMER (WEBSOCKET REAL-TIME)
 * ======================================================================================
 * 
 * Hardware Connections:
 *   INMP441 Mic Pin     ESP32 Pin     Description
 *   --------------------------------------------------------
 *   SCK                 GPIO 14       Clock (BCLK / SCK)
 *   WS                  GPIO 15       Word Select (LRC / WS)
 *   SD                  GPIO 32       Serial Data Out (DOUT / SD)
 *   VDD                 3.3V          Power (DO NOT connect to 5V!)
 *   GND                 GND           Ground
 *   L/R                 GND           Left Channel Select
 * 
 * Required Library in Arduino IDE:
 * - "WebSockets" by Markus Sattler (Search "WebSockets" in Library Manager)
 * ======================================================================================
 */

#include <WiFi.h>
#include <WebSocketsClient.h>
#include <driver/i2s.h>

// ---------------- 1. YOUR WIFI CREDENTIALS ----------------
const char* WIFI_SSID     = "YOUR_WIFI_NAME";      // <-- Apna WiFi Name / Hotspot dalein
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";  // <-- Apna WiFi Password dalein

// ---------------- 2. LAPTOP SERVER DETAILS ----------------
// Laptop ka Local IP (Website ke header me jo IP dikh raha hai)
const char* SERVER_HOST   = "10.21.66.171";        
const int   SERVER_PORT   = 8000;
const char* WS_PATH       = "/ws/esp32";

// ---------------- 3. I2S DIGITAL MIC PINS ----------------
#define I2S_PORT         I2S_NUM_0
#define PIN_I2S_SCK      14   // SCK
#define PIN_I2S_WS       15   // WS
#define PIN_I2S_SD       32   // SD

#define SAMPLE_RATE      16000
#define SAMPLES_PER_READ 256

WebSocketsClient webSocket;
bool isWsConnected = false;

// Audio sample buffers
int32_t raw_i2s_samples[SAMPLES_PER_READ];
int16_t pcm16_samples[SAMPLES_PER_READ];

void setupI2S() {
  Serial.println("[I2S] Initializing INMP441 Microphone...");

  const i2s_config_t i2s_config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate = SAMPLE_RATE,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_32BIT,
    .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
    .communication_format = i2s_comm_format_t(I2S_COMM_FORMAT_STAND_I2S),
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count = 6,
    .dma_buf_len = 512,
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
    Serial.printf("[I2S] Driver install failed! Error: %d\n", err);
    return;
  }

  err = i2s_set_pin(I2S_PORT, &pin_config);
  if (err != ESP_OK) {
    Serial.printf("[I2S] Pin configuration failed! Error: %d\n", err);
    return;
  }

  i2s_zero_dma_buffer(I2S_PORT);
  Serial.println("[I2S] INMP441 Microphone Driver Ready!");
}

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      Serial.println("[WS] Disconnected from Smart Cap Server! Reconnecting...");
      isWsConnected = false;
      break;
    case WStype_CONNECTED:
      Serial.printf("[WS] CONNECTED TO SERVER: %s\n", payload);
      isWsConnected = true;
      // Send handshake confirmation
      webSocket.sendTXT("{\"device\":\"ESP32_INMP441\",\"status\":\"ONLINE\"}");
      break;
    case WStype_TEXT:
      Serial.printf("[WS Server Msg]: %s\n", payload);
      break;
    case WStype_ERROR:
      Serial.println("[WS] WebSocket Error!");
      break;
    default:
      break;
  }
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
    Serial.println("\n[WiFi] Connected Successfully!");
    Serial.print("[WiFi] ESP32 IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n[WiFi] Connection Failed! Check SSID and Password.");
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n========================================================");
  Serial.println("  SMART CAP // ESP32 DIGITAL MIC LIVE STREAMER  ");
  Serial.println("========================================================");

  // 1. Connect to WiFi
  connectWiFi();

  // 2. Setup I2S Mic
  setupI2S();

  // 3. Setup WebSocket connection to Laptop Server
  Serial.printf("[WS] Target Server: ws://%s:%d%s\n", SERVER_HOST, SERVER_PORT, WS_PATH);
  webSocket.begin(SERVER_HOST, SERVER_PORT, WS_PATH);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(2000);
}

void loop() {
  webSocket.loop();

  if (WiFi.status() != WL_CONNECTED) {
    delay(500);
    return;
  }

  // Read audio from INMP441 mic and stream to server
  if (isWsConnected) {
    size_t bytes_read = 0;
    esp_err_t result = i2s_read(I2S_PORT, (void*)raw_i2s_samples, sizeof(raw_i2s_samples), &bytes_read, portMAX_DELAY);

    if (result == ESP_OK && bytes_read > 0) {
      int samples_count = bytes_read / sizeof(int32_t);
      int max_amp = 0;

      for (int i = 0; i < samples_count; i++) {
        // Convert 24-bit audio in 32-bit slot to 16-bit PCM
        int32_t sample = raw_i2s_samples[i] >> 14;

        // Digital gain boost (2x) for clear voice
        sample = sample * 2;

        if (sample > 32767) sample = 32767;
        else if (sample < -32768) sample = -32768;

        pcm16_samples[i] = (int16_t)sample;
        int abs_val = abs(pcm16_samples[i]);
        if (abs_val > max_amp) max_amp = abs_val;
      }

      // Stream binary PCM chunk over WebSocket
      webSocket.sendBIN((uint8_t*)pcm16_samples, samples_count * sizeof(int16_t));

      // Debug volume monitor every 1.5 seconds in Serial Monitor
      static unsigned long last_debug = 0;
      if (millis() - last_debug > 1500) {
        last_debug = millis();
        Serial.printf("[MIC STATUS] Live Stream Active | Mic Peak Volume: %d\n", max_amp);
      }
    }
  }
}
