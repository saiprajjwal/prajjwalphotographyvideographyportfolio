let audioCtx = null;
let soundEnabled = localStorage.getItem('sound_enabled') === 'true';

const initAudio = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
};

export const setSoundEnabled = (enabled) => {
  soundEnabled = enabled;
  localStorage.setItem('sound_enabled', enabled ? 'true' : 'false');
  if (enabled) {
    initAudio();
  }
};

export const getSoundEnabled = () => soundEnabled;

// Synthesize a clean mechanical "lens focus tick" for button hovers
export const playFocusTick = () => {
  if (!soundEnabled) return;
  try {
    initAudio();
    if (!audioCtx) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(900, audioCtx.currentTime + 0.012);

    filter.type = 'highpass';
    filter.frequency.setValueAtTime(800, audioCtx.currentTime);

    gain.gain.setValueAtTime(0.008, audioCtx.currentTime); // ultra subtle volume
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.012);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.012);
  } catch (e) {
    console.warn("Audio Context error:", e);
  }
};

// Synthesize a mechanical camera shutter snap for clicks
export const playShutterClick = () => {
  if (!soundEnabled) return;
  try {
    initAudio();
    if (!audioCtx) return;

    const now = audioCtx.currentTime;

    // 1. Shutter Mirror Flip: Pitch-dropping drop
    const osc = audioCtx.createOscillator();
    const oscGain = audioCtx.createGain();
    osc.connect(oscGain);
    oscGain.connect(audioCtx.destination);

    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.07);

    oscGain.gain.setValueAtTime(0.018, now);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);

    osc.start(now);
    osc.stop(now + 0.07);

    // 2. Physical Curtain Slide: High-frequency filtered noise burst
    const bufferSize = audioCtx.sampleRate * 0.05; // 50ms
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 2200;
    noiseFilter.Q.value = 2.5;

    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.012, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(audioCtx.destination);

    noise.start(now);
    noise.stop(now + 0.05);
  } catch (e) {
    console.warn("Audio Context error:", e);
  }
};
