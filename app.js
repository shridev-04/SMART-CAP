/**
 * SMART CAP // NEURAL 3D AUDIO CORE & STT CLIENT
 * Futuristic Three.js Hologram, 32-Band Spectrum & Dual-Mode STT
 */

// Global State
const state = {
  mode: 'esp32', // Exclusively ESP32 Digital Mic
  language: 'hi-IN', // 'hi-IN' or 'en-IN'
  isMicActive: false,
  sensitivity: 3.5,
  esp32Connected: false,
  isWireframe: true,
  autoRotate: true,
  listenEsp32Audio: true, // Live sound from ESP32 plays through speakers
  history: [],
};

// Real-time Audio Data Arrays
let frequencyBands = new Array(32).fill(0);
let timeDomainData = new Uint8Array(128).fill(128);
let currentRms = 0;
let currentDb = -60;

// Web Audio API References (for Browser Mic Mode)
let audioCtx = null;
let analyserNode = null;
let microphoneStream = null;
let speechRecognizer = null;

// Backend WebSocket
let ws = null;

// =========================================================
// 1. THREE.JS 3D HOLOGRAPHIC QUANTUM VISUALIZER
// =========================================================
let scene, camera, renderer;
let quantumOrb, wireframeOrb, particleSystem, haloRing;
let originalVertices = [];
let clock = new THREE.Clock();

function initThreeScene() {
  const container = document.getElementById('canvas-container');
  const width = container.clientWidth;
  const height = container.clientHeight;

  // Scene
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05070d, 0.04);

  // Camera
  camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
  camera.position.set(0, 0, 7.5);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  container.appendChild(renderer.domElement);

  // Ambient & Directional Lights with Cyberpunk Neon Colors
  const ambientLight = new THREE.AmbientLight(0x0a192f, 2.0);
  scene.add(ambientLight);

  const cyanLight = new THREE.PointLight(0x00f0ff, 3, 50);
  cyanLight.position.set(5, 5, 5);
  scene.add(cyanLight);

  const purpleLight = new THREE.PointLight(0xb026ff, 3, 50);
  purpleLight.position.set(-5, -5, 5);
  scene.add(purpleLight);

  // 1. Central Core Sphere (Solid with glass glow)
  const sphereGeo = new THREE.IcosahedronGeometry(2.2, 4);
  const sphereMat = new THREE.MeshStandardMaterial({
    color: 0x051026,
    emissive: 0x002244,
    roughness: 0.2,
    metalness: 0.8,
    transparent: true,
    opacity: 0.85,
  });
  quantumOrb = new THREE.Mesh(sphereGeo, sphereMat);
  scene.add(quantumOrb);

  // 2. Outer Wireframe Hologram Mesh
  const wireGeo = new THREE.IcosahedronGeometry(2.22, 4);
  const wireMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    wireframe: true,
    transparent: true,
    opacity: 0.6,
  });
  wireframeOrb = new THREE.Mesh(wireGeo, wireMat);
  scene.add(wireframeOrb);

  // Cache base positions for deformation
  const posAttribute = wireGeo.attributes.position;
  originalVertices = [];
  for (let i = 0; i < posAttribute.count; i++) {
    originalVertices.push(new THREE.Vector3().fromBufferAttribute(posAttribute, i));
  }

  // 3. Floating Quantum Particles (Surrounding Nebula)
  const particleCount = 700;
  const particleGeo = new THREE.BufferGeometry();
  const particleCoords = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount * 3; i += 3) {
    const r = 3.2 + Math.random() * 2.8;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);

    particleCoords[i] = r * Math.sin(phi) * Math.cos(theta);
    particleCoords[i + 1] = r * Math.sin(phi) * Math.sin(theta);
    particleCoords[i + 2] = r * Math.cos(phi);
  }
  particleGeo.setAttribute('position', new THREE.BufferAttribute(particleCoords, 3));

  const particleMat = new THREE.PointsMaterial({
    color: 0x00ff9f,
    size: 0.05,
    transparent: true,
    opacity: 0.75,
    blending: THREE.AdditiveBlending,
  });
  particleSystem = new THREE.Points(particleGeo, particleMat);
  scene.add(particleSystem);

  // 4. Glowing Audio Halo Ring (Equator)
  const ringGeo = new THREE.TorusGeometry(3.1, 0.03, 16, 100);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xb026ff,
    transparent: true,
    opacity: 0.8,
    wireframe: true,
  });
  haloRing = new THREE.Mesh(ringGeo, ringMat);
  haloRing.rotation.x = Math.PI / 2.3;
  scene.add(haloRing);

  // Resize listener
  window.addEventListener('resize', onWindowResize);

  // Animation Loop
  animateThree();
}

function onWindowResize() {
  const container = document.getElementById('canvas-container');
  if (!container || !renderer || !camera) return;
  const width = container.clientWidth;
  const height = container.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

let lastTime = performance.now();
let frameCount = 0;

function animateThree() {
  requestAnimationFrame(animateThree);
  const delta = clock.getDelta();
  const time = clock.getElapsedTime();

  // FPS Counter
  frameCount++;
  const now = performance.now();
  if (now - lastTime >= 1000) {
    document.getElementById('fpsCounter').textContent = frameCount;
    frameCount = 0;
    lastTime = now;
  }

  // Calculate audio reactive factors
  // Bass energy (first 6 bands)
  const bass = (frequencyBands.slice(0, 6).reduce((a, b) => a + b, 0) / 6) / 100.0;
  // Mid/High energy (bands 6-24)
  const mids = (frequencyBands.slice(6, 24).reduce((a, b) => a + b, 0) / 18) / 100.0;
  const voiceBoost = Math.max(0, currentRms * state.sensitivity);

  // Rotate 3D objects
  if (state.autoRotate) {
    const rotSpeed = 0.5 + voiceBoost * 1.5;
    quantumOrb.rotation.y += 0.005 * rotSpeed;
    wireframeOrb.rotation.y += 0.005 * rotSpeed;
    wireframeOrb.rotation.x += 0.002 * rotSpeed;

    particleSystem.rotation.y -= 0.003 * rotSpeed;
    particleSystem.rotation.z += 0.001 * rotSpeed;

    haloRing.rotation.z += 0.008 * (1 + bass * 3);
  }

  // Audio-reactive scale pulsation
  const targetScale = 1.0 + voiceBoost * 0.45 + bass * 0.25;
  quantumOrb.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.2);
  wireframeOrb.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.2);

  // Mesh vertex deformation based on voice frequencies
  const posAttr = wireframeOrb.geometry.attributes.position;
  const count = posAttr.count;
  for (let i = 0; i < count; i++) {
    const orig = originalVertices[i];
    if (!orig) continue;

    const bandIndex = i % 32;
    const bandEnergy = (frequencyBands[bandIndex] / 100.0) * state.sensitivity * 0.4;
    const displacement = Math.sin(orig.x * 2.0 + time * 3.0) *
                         Math.cos(orig.y * 2.0 + time * 3.0) * (0.05 + bandEnergy);

    const newX = orig.x + orig.x * displacement;
    const newY = orig.y + orig.y * displacement;
    const newZ = orig.z + orig.z * displacement;

    posAttr.setXYZ(i, newX, newY, newZ);
  }
  posAttr.needsUpdate = true;

  // Reactivity for Halo Ring and Particle System
  haloRing.scale.set(1.0 + bass * 0.6, 1.0 + bass * 0.6, 1.0);
  haloRing.material.color.setHSL(0.75 + bass * 0.2, 1, 0.6);

  renderer.render(scene, camera);
}


// =========================================================
// 2. 2D FREQUENCY SPECTRUM & OSCILLOSCOPE VISUALIZERS
// =========================================================
const freqCanvas = document.getElementById('freqCanvas');
const freqCtx = freqCanvas.getContext('2d');
const waveCanvas = document.getElementById('waveCanvas');
const waveCtx = waveCanvas.getContext('2d');

let peakBars = new Array(32).fill(0);

function drawFrequencySpectrum() {
  requestAnimationFrame(drawFrequencySpectrum);

  const w = freqCanvas.width;
  const h = freqCanvas.height;
  freqCtx.clearRect(0, 0, w, h);

  const barCount = 32;
  const gap = 4;
  const totalGaps = (barCount - 1) * gap;
  const barWidth = (w - totalGaps) / barCount;

  for (let i = 0; i < barCount; i++) {
    // Current band value (0 to 100)
    const val = frequencyBands[i] || 0;
    const barHeight = Math.max(3, (val / 100.0) * (h - 15));
    const x = i * (barWidth + gap);
    const y = h - barHeight;

    // Peak drops smoothly
    if (barHeight > peakBars[i]) {
      peakBars[i] = barHeight;
    } else {
      peakBars[i] = Math.max(0, peakBars[i] - 1.2);
    }

    // High-tech Neon Gradient
    const grad = freqCtx.createLinearGradient(0, h, 0, y);
    if (i < 8) {
      grad.addColorStop(0, 'rgba(0, 240, 255, 0.2)');
      grad.addColorStop(1, '#00f0ff'); // Bass cyan
    } else if (i < 20) {
      grad.addColorStop(0, 'rgba(0, 255, 159, 0.2)');
      grad.addColorStop(1, '#00ff9f'); // Mids emerald green
    } else {
      grad.addColorStop(0, 'rgba(176, 38, 255, 0.2)');
      grad.addColorStop(1, '#b026ff'); // Highs purple
    }

    freqCtx.fillStyle = grad;
    freqCtx.fillRect(x, y, barWidth, barHeight);

    // Peak marker cap
    const peakY = h - peakBars[i] - 3;
    freqCtx.fillStyle = '#ffffff';
    freqCtx.fillRect(x, peakY, barWidth, 2);
  }
}

function drawOscilloscope() {
  requestAnimationFrame(drawOscilloscope);

  const w = waveCanvas.width;
  const h = waveCanvas.height;
  waveCtx.clearRect(0, 0, w, h);

  // Background Grid Lines
  waveCtx.strokeStyle = 'rgba(0, 240, 255, 0.1)';
  waveCtx.lineWidth = 1;
  waveCtx.beginPath();
  waveCtx.moveTo(0, h / 2);
  waveCtx.lineTo(w, h / 2);
  waveCtx.stroke();

  // Waveform line
  waveCtx.lineWidth = 2;
  waveCtx.strokeStyle = '#00f0ff';
  waveCtx.shadowColor = '#00f0ff';
  waveCtx.shadowBlur = 8;
  waveCtx.beginPath();

  const sliceWidth = w / timeDomainData.length;
  let x = 0;

  for (let i = 0; i < timeDomainData.length; i++) {
    const v = timeDomainData[i] / 128.0;
    const y = (v * h) / 2;

    if (i === 0) {
      waveCtx.moveTo(x, y);
    } else {
      waveCtx.lineTo(x, y);
    }
    x += sliceWidth;
  }

  waveCtx.lineTo(w, h / 2);
  waveCtx.stroke();
  waveCtx.shadowBlur = 0; // reset
}


// =========================================================
// 3. BROWSER MICROPHONE & LOCAL SPEECH RECOGNITION (TEST MODE)
// =========================================================
async function startBrowserMic() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    microphoneStream = stream;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const sourceNode = audioCtx.createMediaStreamSource(stream);

    analyserNode = audioCtx.createAnalyser();
    analyserNode.fftSize = 64; // 32 frequency bins
    analyserNode.smoothingTimeConstant = 0.8;
    sourceNode.connect(analyserNode);

    state.isMicActive = true;
    updateMicButtonUI(true);

    // Audio Analysis Loop
    processBrowserAudio();

    // Start Web Speech Recognition
    startSpeechRecognition();

  } catch (err) {
    console.error('Microphone access denied:', err);
    alert('Please allow microphone permissions to test Speech-to-Text.');
    updateMicButtonUI(false);
  }
}

function stopBrowserMic() {
  if (microphoneStream) {
    microphoneStream.getTracks().forEach((track) => track.stop());
    microphoneStream = null;
  }
  if (audioCtx) {
    audioCtx.close();
    audioCtx = null;
  }
  if (speechRecognizer) {
    try {
      speechRecognizer.stop();
    } catch (e) {}
    speechRecognizer = null;
  }
  state.isMicActive = false;
  frequencyBands.fill(0);
  timeDomainData.fill(128);
  updateAudioTelemetry(0, -60, 'IDLE / LISTENING');
  updateMicButtonUI(false);
}

function processBrowserAudio() {
  if (!state.isMicActive || !analyserNode) return;

  const freqArray = new Uint8Array(analyserNode.frequencyBinCount);
  const timeArray = new Uint8Array(analyserNode.fftSize);

  analyserNode.getByteFrequencyData(freqArray);
  analyserNode.getByteTimeDomainData(timeArray);

  // Copy time domain data for oscilloscope
  timeDomainData = new Uint8Array(timeArray);

  // Compute RMS & dB
  let sumSquares = 0;
  for (let i = 0; i < timeArray.length; i++) {
    const normalized = (timeArray[i] - 128) / 128.0;
    sumSquares += normalized * normalized;
  }
  const rms = Math.sqrt(sumSquares / timeArray.length);
  const db = 20 * Math.log10(rms + 1e-5);

  // Scale 32 frequency bands to 0-100
  for (let i = 0; i < 32; i++) {
    const rawVal = freqArray[i] || 0;
    frequencyBands[i] = Math.min(100, Math.round((rawVal / 255.0) * 100 * (state.sensitivity / 2.5)));
  }

  const vadStatus = rms > 0.03 ? 'VOICE DETECTED' : 'IDLE / LISTENING';
  updateAudioTelemetry(rms, db, vadStatus);

  requestAnimationFrame(processBrowserAudio);
}

function startSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.warn('Web Speech API not supported in this browser. Fallback to server STT.');
    return;
  }

  speechRecognizer = new SpeechRecognition();
  speechRecognizer.continuous = true;
  speechRecognizer.interimResults = true;
  speechRecognizer.lang = state.language;

  const liveBox = document.getElementById('liveTranscriptDisplay');

  speechRecognizer.onstart = () => {
    console.log('🎤 Speech recognition active with lang:', state.language);
  };

  speechRecognizer.onresult = (event) => {
    let interimText = '';
    let finalText = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalText += event.results[i][0].transcript;
      } else {
        interimText += event.results[i][0].transcript;
      }
    }

    if (interimText) {
      liveBox.innerHTML = `<span class="neon-cyan">${interimText}</span>`;
    }

    if (finalText) {
      liveBox.innerHTML = `<strong>${finalText}</strong>`;
      addTranscriptToHistory(finalText.trim(), 'browser_mic', state.language);

      // Relay to server/other peers
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          action: 'browser_transcript',
          text: finalText.trim(),
        }));
      }
    }
  };

  speechRecognizer.onerror = (e) => {
    console.warn('SpeechRecognition error:', e.error);
    if (e.error === 'not-allowed') {
      stopBrowserMic();
    }
  };

  speechRecognizer.onend = () => {
    // Auto restart if mic is still active
    if (state.isMicActive && state.mode === 'browser') {
      try {
        speechRecognizer.start();
      } catch (e) {}
    }
  };

  try {
    speechRecognizer.start();
  } catch (err) {
    console.error('Error starting recognition:', err);
  }
}


// =========================================================
// 4. BACKEND WEBSOCKET & ESP32 SYNC
// =========================================================
function connectBackendWebSocket(customUrl = null) {
  const isVercel = window.location.hostname.includes('vercel.app') || window.location.hostname.includes('vercel');

  let wsUrl = customUrl;
  if (!wsUrl) {
    if (isVercel) {
      console.log('Running on Vercel deployment. Defaulting to Cloud Browser Mic mode.');
      const esp32Input = document.getElementById('esp32UrlInput');
      if (esp32Input) {
        esp32Input.placeholder = 'Enter WebSocket URL (e.g. wss://your-tunnel.app/ws/esp32)';
      }
      const statusTitle = document.getElementById('esp32StatusText');
      const statusIp = document.getElementById('esp32ClientIp');
      const statusDot = document.getElementById('esp32StatusDot');
      if (statusTitle) {
        statusTitle.textContent = 'VERCEL CLOUD: ACTIVE';
        statusTitle.style.color = '#00ff9f';
      }
      if (statusDot) statusDot.classList.add('online');
      if (statusIp) statusIp.textContent = 'Ready: Browser Mic Test or Tunnel';
      return;
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    wsUrl = `${protocol}//${window.location.host}/ws/web`;
  }

  try {
    if (ws) {
      try { ws.close(); } catch (e) {}
    }
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('Connected to WebSocket:', wsUrl);
      const text = document.getElementById('esp32StatusText');
      if (text) {
        text.textContent = 'WEBSOCKET: CONNECTED';
        text.style.color = '#00ff9f';
      }
      const dot = document.getElementById('esp32StatusDot');
      if (dot) dot.classList.add('online');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleServerMessage(msg);
      } catch (e) {
        console.error('Error parsing WS message:', e);
      }
    };

    ws.onclose = () => {
      if (!isVercel) {
        console.warn('Backend WS disconnected. Reconnecting in 3s...');
        setTimeout(() => connectBackendWebSocket(), 3000);
      }
    };
  } catch (err) {
    console.warn('WebSocket connection error:', err);
  }
}

let playbackAudioCtx = null;
let nextPlayTime = 0;

function playEsp32PcmChunk(b64Data) {
  if (!state.listenEsp32Audio) return;
  try {
    if (!playbackAudioCtx) {
      playbackAudioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      nextPlayTime = playbackAudioCtx.currentTime;
    }
    if (playbackAudioCtx.state === 'suspended') {
      playbackAudioCtx.resume();
    }

    const binaryString = atob(b64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768.0;
    }

    const buffer = playbackAudioCtx.createBuffer(1, float32.length, 16000);
    buffer.copyToChannel(float32, 0);

    const source = playbackAudioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(playbackAudioCtx.destination);

    if (nextPlayTime < playbackAudioCtx.currentTime) {
      nextPlayTime = playbackAudioCtx.currentTime;
    }
    source.start(nextPlayTime);
    nextPlayTime += buffer.duration;
  } catch (err) {
    console.error('Playback error:', err);
  }
}

function handleServerMessage(msg) {
  switch (msg.type) {
    case 'welcome':
      document.getElementById('esp32UrlInput').value = msg.ws_esp32_url;
      updateEsp32Status(msg.esp32_connected, msg.local_ip);
      break;

    case 'esp32_status':
      updateEsp32Status(msg.connected, msg.ip);
      break;

    case 'frequency_data':
      // When ESP32 mode is active, drive visualizer from ESP32 FFT data
      if (state.mode === 'esp32' && msg.source === 'esp32') {
        if (msg.bands && msg.bands.length) {
          frequencyBands = msg.bands;
        }
        const vad = msg.rms > 0.02 ? 'ESP32 VOICE DETECTED' : 'ESP32 LISTENING';
        updateAudioTelemetry(msg.rms || 0, msg.db || -60, vad);

        // Live Speaker Audio Output (Hear ESP32 mic on laptop)
        if (msg.audio_b64) {
          playEsp32PcmChunk(msg.audio_b64);
        }

        // Generate synthetic wave data from FFT for oscilloscope
        for (let i = 0; i < timeDomainData.length; i++) {
          const s = Math.sin((i / 10) + Date.now() / 100) * (msg.rms * 120);
          timeDomainData[i] = 128 + Math.floor(s);
        }
      }
      break;

    case 'transcript':
      document.getElementById('liveTranscriptDisplay').innerHTML =
        `<strong>${msg.text}</strong>`;
      addTranscriptToHistory(msg.text, msg.source || 'esp32', msg.language || state.language);
      break;

    case 'language_changed':
      state.language = msg.language;
      updateLanguageButtonsUI(msg.language);
      break;
  }
}

function updateEsp32Status(connected, ip) {
  state.esp32Connected = connected;
  const statusBox = document.getElementById('esp32StatusBox');
  const dot = document.getElementById('esp32StatusDot');
  const text = document.getElementById('esp32StatusText');
  const ipLabel = document.getElementById('esp32ClientIp');

  if (connected) {
    dot.classList.add('online');
    text.textContent = 'ESP32: CONNECTED (ONLINE)';
    text.style.color = '#00ff9f';
    ipLabel.textContent = `IP: ${ip || '10.21.66.x'} // 16kHz Stream Active`;
  } else {
    dot.classList.remove('online');
    text.textContent = 'ESP32: DISCONNECTED';
    text.style.color = '#fff';
    ipLabel.textContent = 'Waiting for WebSocket handshake...';
  }
}


// =========================================================
// 5. UI CONTROLS & EVENT HANDLERS
// =========================================================
function initUIEvents() {
  // Mode Selection: Browser Mic vs ESP32 Stream
  const btnBrowser = document.getElementById('btnModeBrowser');
  const btnEsp32 = document.getElementById('btnModeEsp32');

  btnBrowser.addEventListener('click', () => {
    state.mode = 'browser';
    btnBrowser.classList.add('active');
    btnEsp32.classList.remove('active');
    document.getElementById('activeSourceTag').textContent = 'DEVICE MIC';
    document.getElementById('activeSourceTag').className = 'tag-val neon-cyan';
    document.getElementById('btnToggleMic').style.display = 'flex';
  });

  btnEsp32.addEventListener('click', () => {
    state.mode = 'esp32';
    btnEsp32.classList.add('active');
    btnBrowser.classList.remove('active');
    document.getElementById('activeSourceTag').textContent = 'ESP32 CLOUD';
    document.getElementById('activeSourceTag').className = 'tag-val neon-green';
    // If browser mic was on, turn it off to save resources
    if (state.isMicActive) {
      stopBrowserMic();
    }
  });

  // Start / Stop Mic Button
  const btnMic = document.getElementById('btnToggleMic');
  btnMic.addEventListener('click', () => {
    if (state.isMicActive) {
      stopBrowserMic();
    } else {
      startBrowserMic();
    }
  });

  // Toggle Wireframe / Solid Mode
  const btnWire = document.getElementById('btnToggleMesh');
  btnWire.addEventListener('click', () => {
    state.isWireframe = !state.isWireframe;
    wireframeOrb.visible = state.isWireframe;
    document.getElementById('meshModeText').textContent = state.isWireframe ? 'WIREFRAME' : 'SOLID CORE';
  });

  // Toggle Rotation
  const btnRot = document.getElementById('btnToggleRotation');
  btnRot.addEventListener('click', () => {
    state.autoRotate = !state.autoRotate;
    btnRot.style.borderColor = state.autoRotate ? 'var(--neon-cyan)' : 'var(--border-subtle)';
  });

  // Sensitivity Slider
  const slider = document.getElementById('gainSlider');
  slider.addEventListener('input', (e) => {
    state.sensitivity = parseFloat(e.target.value);
    document.getElementById('gainValText').textContent = `${state.sensitivity}x`;
  });

  // Language Buttons
  const btnHi = document.getElementById('btnLangHi');
  const btnEn = document.getElementById('btnLangEn');

  btnHi.addEventListener('click', () => changeLanguage('hi-IN'));
  btnEn.addEventListener('click', () => changeLanguage('en-IN'));

  // Copy ESP32 WebSocket URL
  const btnCopy = document.getElementById('btnCopyEsp32Url');
  const copyInput = document.getElementById('esp32UrlInput');
  const copyAlert = document.getElementById('copySuccessAlert');

  btnCopy.addEventListener('click', () => {
    copyInput.select();
    navigator.clipboard.writeText(copyInput.value).then(() => {
      copyAlert.classList.add('show');
      setTimeout(() => copyAlert.classList.remove('show'), 2000);
    });
  });

  // Connect to Custom WebSocket URL
  const btnConnect = document.getElementById('btnConnectCustomWs');
  if (btnConnect) {
    btnConnect.addEventListener('click', () => {
      const url = copyInput.value.trim();
      if (url) {
        connectBackendWebSocket(url);
      }
    });
  }

  // Toggle Live Audio Listening to ESP32 Mic through laptop speakers
  const btnAudioListen = document.getElementById('btnToggleAudioListen');
  if (btnAudioListen) {
    btnAudioListen.addEventListener('click', () => {
      state.listenEsp32Audio = !state.listenEsp32Audio;
      const text = document.getElementById('listenAudioText');
      if (state.listenEsp32Audio) {
        text.textContent = 'SPEAKER: LIVE ON';
        btnAudioListen.style.borderColor = 'var(--neon-green)';
        btnAudioListen.style.color = 'var(--neon-green)';
        if (!playbackAudioCtx) {
          playbackAudioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        }
        if (playbackAudioCtx.state === 'suspended') {
          playbackAudioCtx.resume();
        }
      } else {
        text.textContent = 'SPEAKER: OFF';
        btnAudioListen.style.borderColor = 'var(--border-subtle)';
        btnAudioListen.style.color = 'var(--text-primary)';
      }
    });
  }

  // History Actions
  document.getElementById('btnClearHistory').addEventListener('click', () => {
    state.history = [];
    renderHistory();
  });

  document.getElementById('btnCopyHistory').addEventListener('click', () => {
    const textAll = state.history.map((h) => `[${h.time}] ${h.source}: ${h.text}`).join('\n');
    navigator.clipboard.writeText(textAll).then(() => alert('All transcripts copied!'));
  });

  document.getElementById('btnDownloadHistory').addEventListener('click', () => {
    const textAll = state.history.map((h) => `[${h.time}] [${h.source} | ${h.lang}]: ${h.text}`).join('\n');
    const blob = new Blob([textAll], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `smart_cap_transcripts_${Date.now()}.txt`;
    a.click();
  });

  // Text-to-Speech Replay
  document.getElementById('btnSpeakLast').addEventListener('click', () => {
    if (state.history.length === 0) return;
    const lastItem = state.history[0];
    const utterance = new SpeechSynthesisUtterance(lastItem.text);
    utterance.lang = lastItem.lang || 'hi-IN';
    window.speechSynthesis.speak(utterance);
  });
}

function changeLanguage(lang) {
  state.language = lang;
  updateLanguageButtonsUI(lang);

  // Sync with server
  fetch('/api/language', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language: lang }),
  });

  // Restart speech recognition if active
  if (state.isMicActive && speechRecognizer) {
    try {
      speechRecognizer.stop();
    } catch (e) {}
  }
}

function updateLanguageButtonsUI(lang) {
  const btnHi = document.getElementById('btnLangHi');
  const btnEn = document.getElementById('btnLangEn');
  if (lang.startsWith('hi')) {
    btnHi.classList.add('active');
    btnEn.classList.remove('active');
  } else {
    btnEn.classList.add('active');
    btnHi.classList.remove('active');
  }
}

function updateMicButtonUI(isActive) {
  const btnMic = document.getElementById('btnToggleMic');
  const btnText = document.getElementById('btnMicText');
  if (isActive) {
    btnMic.classList.add('active');
    btnText.textContent = 'STOP MIC';
  } else {
    btnMic.classList.remove('active');
    btnText.textContent = 'START MIC';
  }
}

function updateAudioTelemetry(rms, db, vadStatus) {
  currentRms = rms;
  currentDb = db;

  document.getElementById('rmsValueTag').textContent = rms.toFixed(4);
  document.getElementById('vadStateTag').textContent = vadStatus;

  const dbTag = document.getElementById('dbReadout');
  dbTag.textContent = `${db.toFixed(1)} dB`;

  // Update meter fill (range -60dB to 0dB)
  const percent = Math.min(100, Math.max(0, ((db + 60) / 60) * 100));
  document.getElementById('meterFill').style.width = `${percent}%`;
}

function addTranscriptToHistory(text, source, lang) {
  if (!text) return;
  const now = new Date();
  const timeStr = now.toLocaleTimeString();

  state.history.unshift({
    text,
    source: (source && source.includes('esp32')) ? 'ESP32 CLOUD' : 'DEVICE MIC',
    sourceClass: (source && source.includes('esp32')) ? 'esp32' : 'browser',
    lang: lang,
    time: timeStr,
  });

  // Keep last 40 entries
  if (state.history.length > 40) state.history.pop();
  renderHistory();
}

function renderHistory() {
  const list = document.getElementById('transcriptFeed');
  if (state.history.length === 0) {
    list.innerHTML = `
      <div class="history-empty" id="historyEmptyMsg">
        <i class="fa-solid fa-wave-square"></i>
        <p>No audio recognized yet. Say "Namaste" or "Hello Smart Cap"!</p>
      </div>`;
    return;
  }

  let html = '';
  for (const item of state.history) {
    html += `
      <div class="history-item">
        <div class="history-item-top">
          <span class="source-badge ${item.sourceClass}">${item.source} [${item.lang}]</span>
          <span>${item.time}</span>
        </div>
        <div class="history-text">${item.text}</div>
      </div>
    `;
  }
  list.innerHTML = html;
}

let lastPolledTimestamp = 0;

function startCloudPolling() {
  setInterval(async () => {
    if (state.mode !== 'esp32') return;
    try {
      const res = await fetch('/api/stream');
      if (!res.ok) return;
      const data = await res.json();

      updateEsp32Status(data.esp32_connected, 'Vercel Cloud API');

      if (data.bands && data.bands.length) {
        frequencyBands = data.bands;
      }

      const vad = data.rms > 0.02 ? 'ESP32 VOICE DETECTED' : 'ESP32 LISTENING';
      updateAudioTelemetry(data.rms || 0, data.db || -60, vad);

      if (data.latest_transcript && data.last_timestamp > lastPolledTimestamp) {
        lastPolledTimestamp = data.last_timestamp;
        document.getElementById('liveTranscriptDisplay').innerHTML = `<strong>${data.latest_transcript}</strong>`;
        addTranscriptToHistory(data.latest_transcript, 'esp32', data.language || state.language);
      }
    } catch (e) {
      // background polling error ignored
    }
  }, 600);
}


// =========================================================
// 6. INITIALIZATION ON PAGE LOAD
// =========================================================
window.addEventListener('DOMContentLoaded', () => {
  initThreeScene();
  drawFrequencySpectrum();
  drawOscilloscope();
  initUIEvents();

  const origin = window.location.origin;
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const esp32Input = document.getElementById('esp32UrlInput');

  // Automatically generate public cloud endpoint
  if (!isLocal) {
    // VERCEL CLOUD ENVIRONMENT
    esp32Input.value = `${origin}/api/audio`;
    const text = document.getElementById('esp32StatusText');
    const ipLabel = document.getElementById('esp32ClientIp');
    const dot = document.getElementById('esp32StatusDot');
    if (text) {
      text.textContent = 'VERCEL CLOUD: ACTIVE';
      text.style.color = '#00ff9f';
    }
    if (dot) dot.classList.add('online');
    if (ipLabel) ipLabel.textContent = 'Cloud Endpoint Ready for ESP32';
  } else {
    // Local development fallback
    connectBackendWebSocket();
    fetch('/api/info')
      .then((r) => r.json())
      .then((info) => {
        esp32Input.value = info.ws_esp32_url || `${origin}/api/audio`;
        updateEsp32Status(info.esp32_connected, info.local_ip);
      })
      .catch(() => {
        esp32Input.value = `${origin}/api/audio`;
      });
  }

  startCloudPolling();
});
