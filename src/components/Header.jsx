import React, { useState, useEffect, useRef } from 'react';
import { toggleAudio, getAudioWaveform, isAudioEnabled } from '../utils/sound';

export default function Header({ cycles, peCount = 8 }) {
  const [audioActive, setAudioActive] = useState(false);
  const oscCanvasRef = useRef(null);

  const handleAudioToggle = () => {
    const newState = toggleAudio();
    setAudioActive(newState);
  };

  // Oscilloscope Animation Loop
  useEffect(() => {
    const canvas = oscCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId;
    let phase = 0;

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Background HUD frame
      ctx.fillStyle = 'rgba(6, 8, 10, 0.85)';
      ctx.fillRect(0, 0, w, h);

      // Center subtle reference line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      const wave = getAudioWaveform();
      const enabled = isAudioEnabled();

      ctx.beginPath();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = enabled ? '#00ff88' : 'rgba(255, 255, 255, 0.2)';
      ctx.shadowColor = enabled ? '#00ff88' : 'transparent';
      ctx.shadowBlur = enabled ? 6 : 0;

      if (enabled && wave) {
        // Live audio wave
        const sliceWidth = w / wave.length;
        let x = 0;
        for (let i = 0; i < wave.length; i++) {
          const v = wave[i] / 128.0; // 0..2
          const y = (v * h) / 2;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceWidth;
        }
      } else {
        // Idle gentle scanner sweep
        phase += 0.06;
        for (let x = 0; x < w; x++) {
          const y = h / 2 + Math.sin(x * 0.12 + phase) * (enabled ? 3 : 1.2);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
      ctx.shadowBlur = 0;

      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <header className="hud-header">
      <div className="hud-title-wrap">
        <div className="hud-radar-icon">
          <div style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: 'var(--neon-emerald)',
            boxShadow: '0 0 10px var(--neon-emerald)',
            animation: 'hazardBlink 1.5s infinite'
          }} />
        </div>
        <div>
          <h1 className="hud-title">SIMD // DEFENSE SYSTEM</h1>
          <p className="hud-subtitle">VIV-SPEC 2026 // NODE.JS + REACT.JS COMPUTATION HUD</p>
        </div>
      </div>

      <div className="hud-telemetry">
        <div className="telemetry-item">
          <span className="telemetry-label">SECURITY CLASSIFICATION</span>
          <span className="telemetry-val" style={{ color: '#ffffff' }}>AIR-GAPPED // TOP SECRET</span>
        </div>

        <div className="telemetry-item">
          <span className="telemetry-label">SIMD PIPELINE TELEMETRY</span>
          <span className="telemetry-val" style={{ color: 'var(--neon-emerald)' }}>
            CYCLES: {String(cycles).padStart(4, '0')} | {peCount} LANES
          </span>
        </div>

        {/* Live Audio Oscilloscope */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <canvas
            ref={oscCanvasRef}
            width={90}
            height={26}
            style={{
              borderRadius: '4px',
              border: '1px solid var(--border-neon)',
              display: 'block'
            }}
            title="Real-time Acoustic Waveform Monitor"
          />

          <button className="audio-toggle-btn" onClick={handleAudioToggle} title="Toggle Tactical Audio Feedback">
            <span>{audioActive ? '🔊' : '🔇'}</span>
            <span>SOUND: <strong style={{ color: audioActive ? 'var(--neon-emerald)' : 'var(--text-dim)' }}>
              {audioActive ? 'ARMED' : 'MUTED'}
            </strong></span>
          </button>
        </div>
      </div>
    </header>
  );
}
