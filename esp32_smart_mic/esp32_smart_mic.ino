/**
 * ======================================================================================
 * SMART CAP - ESP32 DIGITAL I2S MIC (INMP441) AUDIO STREAMER
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
 * Required Arduino Libraries:
 * 1. "WebSockets" by Markus Sattler (Search "WebSockets" in Arduino Library Manager)
 * 2. WiFi.h (Built-in ESP32 core)
 * 
 * How to Flash:
 * 1. Open this file in Arduino IDE.
 * 2. Select Board: "ESP32 Dev Module" or "DOIT ESP32 DEVKIT V1".
 * 3. Update WIFI_SSID and WIFI_PASSWORD below.
 * 4. Update SERVER_IP with the IP displayed on your Smart Cap website (e.g., 10.21.66.171).
 * 5. Click Upload and open Serial Monitor at 115200 baud!
 * ======================================================================================
 */

#include <WiFi.h>
#include <WebSocketsClient.h>
#include <driver/i2s.h>

// ---------------- WIFI & SERVER CONFIGURATION ----------------
const char* WIFI_SSID     = "YOUR_WIFI_NAME";      // <-- Enter your WiFi SSID
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";  // <-- Enter your WiFi Password

// Server details (Must match the IP shown on your Smart Cap website)
const char* SERVER_HOST   = "10.21.66.171";        // <-- Enter your Laptop's IP address
const int   SERVER_PORT   = 8000;
const char* WS_PATH       = "/ws/esp32";

// ---------------- I2S MIC CONFIGURATION ----------------
#define I2S_PORT         I2S_NUM_0
#define PIN_I2S_SCK      14   // BCLK
#define PIN_I2S_WS       15   // LRC / WS
#define PIN_I2S_SD       32   // DOUT / SD

#define SAMPLE_RATE      16000
#define DMA_BUF_COUNT    8
#define DMA_BUF_LEN      512
#define SAMPLES_PER_READ 256

WebSocketsClient webSocket;
bool isWsConnected = false;

// Buffers for audio processing
// INMP441 sends 32-bit words (24-bit audio). We convert them to 16-bit PCM for STT.
int32_t raw_i2s_samples[SAMPLES_PER_READ];
int16_t pcm16_samples[SAMPLES_PER_READ];

void setupI2S() {
  Serial.println("[I2S] Initializing I2S Driver for INMP441...");

  const i2s_config_t i2s_config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate = SAMPLE_RATE,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_32BIT, // INMP441 outputs 24-bit data in 32-bit slot
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
    Serial.printf("[I2S] Failed to install driver: %d\n", err);
    return;
  }

  err = i2s_set_pin(I2S_PORT, &pin_config);
  if (err != ESP_OK) {
    Serial.printf("[I2S] Failed to set pin configuration: %d\n", err);
    return;
  }

  i2s_zero_dma_buffer(I2S_PORT);
  Serial.println("[I2S] I2S Microphone Initialized Successfully!");
}

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      Serial.println("[WS] Disconnected from Smart Cap Server!");
      isWsConnected = false;
      break;
    case WStype_CONNECTED:
      Serial.printf("[WS] Connected to Server: %s\n", payload);
      isWsConnected = true;
      // Send handshake JSON
      webSocket.sendTXT("{\"device\":\"ESP32_SMART_CAP\",\"sample_rate\":16000,\"format\":\"PCM16_MONO\"}");
      break;
    case WStype_TEXT:
      Serial.printf("[WS] Server Message: %s\n", payload);
      break;
    case WStype_ERROR:
      Serial.println("[WS] Error occurred!");
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
  while (WiFi.status() != WL_CONNECTED && retries < 30) {
    delay(500);
    Serial.print(".");
    retries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Connected Successfully!");
    Serial.print("[WiFi] ESP32 IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n[WiFi] Failed to connect! Check your SSID & Password.");
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n========================================================");
  Serial.println("  SMART CAP // ESP32 DIGITAL MIC AUDIO STREAMER  ");
  Serial.println("========================================================");

  // 1. Connect WiFi
  connectWiFi();

  // 2. Setup I2S Mic
  setupI2S();

  // 3. Setup WebSocket Client
  Serial.printf("[WS] Connecting to ws://%s:%d%s\n", SERVER_HOST, SERVER_PORT, WS_PATH);
  webSocket.begin(SERVER_HOST, SERVER_PORT, WS_PATH);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(3000);
}

void loop() {
  // Handle WebSocket events
  webSocket.loop();

  // Check WiFi status
  if (WiFi.status() != WL_CONNECTED) {
    delay(500);
    return;
  }

  // If connected, read audio from INMP441 and stream
  if (isWsConnected) {
    size_t bytes_read = 0;
    esp_err_t result = i2s_read(I2S_PORT, (void*)raw_i2s_samples, sizeof(raw_i2s_samples), &bytes_read, portMAX_DELAY);

    if (result == ESP_OK && bytes_read > 0) {
      int samples_count = bytes_read / sizeof(int32_t);

      // Convert 24-bit / 32-bit I2S data to 16-bit PCM with digital gain
      for (int i = 0; i < samples_count; i++) {
        // Shift right by 14 bits to extract clean 16-bit audio
        int32_t sample = raw_i2s_samples[i] >> 14;

        // Clamp to 16-bit signed range (-32768 to 32767)
        if (sample > 32767) sample = 32767;
        else if (sample < -32768) sample = -32768;

        pcm16_samples[i] = (int16_t)sample;
      }

      // Send raw 16-bit PCM bytes over WebSocket
      webSocket.sendBIN((uint8_t*)pcm16_samples, samples_count * sizeof(int16_t));
    }
  }
}
