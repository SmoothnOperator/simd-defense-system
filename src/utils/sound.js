/**
 * Web Audio API Synthesizer for Cyber HUD Sound Effects
 * Includes AnalyserNode for Live HUD Oscilloscope Visualization
 */

let audioCtx = null;
let audioEnabled = false;
let analyserNode = null;
let dataArray = null;

export function initAudio() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
      analyserNode = audioCtx.createAnalyser();
      analyserNode.fftSize = 64;
      analyserNode.smoothingTimeConstant = 0.8;
      analyserNode.connect(audioCtx.destination);
      dataArray = new Uint8Array(analyserNode.frequencyBinCount);
    }
  }
}

export function toggleAudio() {
  initAudio();
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  audioEnabled = !audioEnabled;
  if (audioEnabled) {
    playCyberBeep(880, 'sine', 0.08);
  }
  return audioEnabled;
}

export function isAudioEnabled() {
  return audioEnabled;
}

export function getAudioAnalyser() {
  return analyserNode;
}

export function getAudioWaveform() {
  if (!analyserNode || !dataArray) return null;
  analyserNode.getByteTimeDomainData(dataArray);
  return dataArray;
}

export function playCyberBeep(freq = 600, type = 'sine', duration = 0.08) {
  if (!audioEnabled || !audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    if (analyserNode) {
      gain.connect(analyserNode);
    } else {
      gain.connect(audioCtx.destination);
    }
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {
    // AudioContext suspended or blocked by user gesture policy
  }
}

export function playScanTone() {
  if (!audioEnabled || !audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1400, audioCtx.currentTime + 0.85);
    gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.85);
    osc.connect(gain);
    if (analyserNode) {
      gain.connect(analyserNode);
    } else {
      gain.connect(audioCtx.destination);
    }
    osc.start();
    osc.stop(audioCtx.currentTime + 0.85);
  } catch (e) {}
}
