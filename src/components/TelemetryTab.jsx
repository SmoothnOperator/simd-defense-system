import React, { useState, useEffect, useRef } from 'react';
import { playCyberBeep } from '../utils/sound';

export default function TelemetryTab() {
  const [graphMode, setGraphMode] = useState('length'); // 'length', 'amdahl', or 'roofline'
  const [nVal, setNVal] = useState(64);
  const [fVal, setFVal] = useState(90);
  const [intensity, setIntensity] = useState(1.25); // FLOPs / Byte (for Roofline)
  const [memBandwidth, setMemBandwidth] = useState(64); // GB/s
  const [autoScan, setAutoScan] = useState(true); // Auto-scan running animation enabled by default!
  const [hoverPos, setHoverPos] = useState(null);

  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const autoScanRef = useRef(autoScan);
  autoScanRef.current = autoScan;

  const nValRef = useRef(nVal);
  nValRef.current = nVal;
  const fValRef = useRef(fVal);
  fValRef.current = fVal;
  const intensityRef = useRef(intensity);
  intensityRef.current = intensity;
  const graphModeRef = useRef(graphMode);
  graphModeRef.current = graphMode;
  const hoverPosRef = useRef(hoverPos);
  hoverPosRef.current = hoverPos;

  // Switch mode
  const handleModeSwitch = (mode) => {
    setGraphMode(mode);
    playCyberBeep(820, 'sine', 0.04);
  };

  // Toggle Auto-Scan
  const toggleAutoScan = () => {
    setAutoScan(prev => {
      const next = !prev;
      playCyberBeep(next ? 980 : 420, 'triangle', 0.06);
      return next;
    });
  };

  // Slider change handlers
  const handleNSlider = (val) => {
    const n = parseInt(val) || 1;
    setNVal(n);
    setAutoScan(false);
    playCyberBeep(320 + Math.min(n * 3, 600), 'sine', 0.02);
  };

  const handleFSlider = (val) => {
    const f = parseInt(val) || 0;
    setFVal(f);
    setAutoScan(false);
    playCyberBeep(280 + f * 6, 'sine', 0.02);
  };

  const handleIntensitySlider = (val) => {
    const flp = parseFloat(val) || 0.1;
    setIntensity(flp);
    setAutoScan(false);
    playCyberBeep(400 + Math.min(flp * 80, 500), 'sine', 0.02);
  };

  const setIntensityPreset = (val) => {
    setIntensity(val);
    setAutoScan(false);
    playCyberBeep(750, 'triangle', 0.04);
  };

  // Metrics calculation
  const curScalar = 5 * nVal;
  const curVector = Math.ceil(nVal / 64) * 12 + nVal;
  const curLengthSpd = (curScalar / curVector).toFixed(2);

  const curFDec = fVal / 100;
  const curAmdahlInf = (1 / (1 - curFDec)).toFixed(2);
  const curAmdahl16 = (1 / ((1 - curFDec) + curFDec / 16)).toFixed(2);

  const peakCompute = 96; // GFLOP/s peak SIMD
  const attainablePerf = Math.min(peakCompute, intensity * memBandwidth);
  const isMemoryBound = intensity * memBandwidth < peakCompute;

  // 60FPS Continuous Animation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let startTime = performance.now();

    const render = () => {
      const animTime = (performance.now() - startTime) * 0.001;

      // Handle Auto-Scan smooth oscillation
      if (autoScanRef.current) {
        const sweepSpeed = 0.25; // cycle every ~4 seconds
        const sinWave = (Math.sin(animTime * sweepSpeed * Math.PI * 2) * 0.5 + 0.5);

        if (graphModeRef.current === 'length') {
          const autoN = Math.round(1 + sinWave * 199);
          setNVal(autoN);
        } else if (graphModeRef.current === 'amdahl') {
          const autoF = Math.round(sinWave * 95);
          setFVal(autoF);
        } else if (graphModeRef.current === 'roofline') {
          const minLog = Math.log2(0.05);
          const maxLog = Math.log2(8.0);
          const autoInt = Math.pow(2, minLog + sinWave * (maxLog - minLog));
          setIntensity(autoInt);
        }
      }

      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = 360;
      const dpr = window.devicePixelRatio || 1;

      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.height = `${h}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      ctx.clearRect(0, 0, w, h);

      const padLeft = 65;
      const padRight = 50;
      const padTop = 60;
      const padBottom = 55;
      const pw = w - padLeft - padRight;
      const ph = h - padTop - padBottom;

      // Outer cyber backdrop
      ctx.fillStyle = "rgba(6, 8, 12, 0.98)";
      ctx.fillRect(padLeft, padTop, pw, ph);

      // Subtle dynamic grid lines with animated shimmer
      ctx.lineWidth = 1;
      const gridCols = 8;
      for (let g = 0; g <= gridCols; g++) {
        const gx = padLeft + (g / gridCols) * pw;
        const gridAlpha = 0.04 + Math.sin(animTime * 2 + g) * 0.02;
        ctx.strokeStyle = `rgba(0, 240, 255, ${gridAlpha})`;
        ctx.beginPath();
        ctx.moveTo(gx, padTop);
        ctx.lineTo(gx, padTop + ph);
        ctx.stroke();
      }

      // Live Telemetry Scanning Radar Beam
      const scanPhase = (animTime * 0.18) % 1.0;
      const scanX = padLeft + scanPhase * pw;

      const scanGrad = ctx.createLinearGradient(scanX - 50, 0, scanX, 0);
      scanGrad.addColorStop(0, "rgba(0, 240, 255, 0.0)");
      scanGrad.addColorStop(0.8, "rgba(0, 240, 255, 0.08)");
      scanGrad.addColorStop(1.0, "rgba(0, 255, 136, 0.22)");
      ctx.fillStyle = scanGrad;
      ctx.fillRect(Math.max(padLeft, scanX - 50), padTop, Math.min(pw, 50), ph);

      // Glowing scanline beam
      ctx.strokeStyle = "rgba(0, 255, 136, 0.75)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(scanX, padTop);
      ctx.lineTo(scanX, padTop + ph);
      ctx.stroke();

      // Border glow
      ctx.strokeStyle = "rgba(0, 240, 255, 0.35)";
      ctx.lineWidth = 1.2;
      ctx.strokeRect(padLeft, padTop, pw, ph);

      const currentMode = graphModeRef.current;
      const currentN = nValRef.current;
      const currentF = fValRef.current;
      const currentIntensity = intensityRef.current;

      if (currentMode === 'length') {
        // ==========================================
        // MODE 1: SPEEDUP vs VECTOR LENGTH (n)
        // Multi-Color Running Telemetry Curve
        // ==========================================
        ctx.textAlign = "center";
        ctx.font = "bold 13px 'Orbitron', monospace";
        ctx.fillStyle = "#ffffff";
        ctx.fillText("SPEEDUP vs VECTOR LENGTH (n)", w / 2, 26);

        ctx.font = "10px 'JetBrains Mono', monospace";
        ctx.fillStyle = "#00f0ff";
        ctx.fillText("PIPELINE STARTUP AMORTISATION & STRIP-MINING SAWTOOTH // SCALAR vs VECTOR", w / 2, 42);

        // Y-AXIS (0x to 5x)
        for (let tick = 0; tick <= 5; tick++) {
          const yPos = padTop + ph - (tick / 5.0) * ph;
          ctx.beginPath();
          ctx.strokeStyle = tick === 1 ? "rgba(245, 158, 11, 0.55)" : "rgba(255, 255, 255, 0.08)";
          ctx.lineWidth = tick === 1 ? 1.5 : 1;
          if (tick === 1) {
            ctx.setLineDash([5, 4]);
            ctx.lineDashOffset = -animTime * 12; // Marching dashed line for baseline!
          }
          ctx.moveTo(padLeft, yPos);
          ctx.lineTo(padLeft + pw, yPos);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.textAlign = "right";
          ctx.font = tick === 1 ? "bold 10px 'JetBrains Mono', monospace" : "10px 'JetBrains Mono', monospace";
          ctx.fillStyle = tick === 1 ? "#fbbf24" : "#94a3b8";
          ctx.fillText(tick.toFixed(1) + "x", padLeft - 10, yPos + 3.5);
        }

        // Y-axis label
        ctx.save();
        ctx.translate(18, padTop + ph / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = "center";
        ctx.fillStyle = "#38bdf8";
        ctx.font = "10px 'JetBrains Mono', monospace";
        ctx.fillText("Speedup over Scalar (Cycles_Scalar / Cycles_SIMD)", 0, 0);
        ctx.restore();

        // X-AXIS
        const xTicks = [1, 32, 64, 96, 128, 160, 200];
        xTicks.forEach(val => {
          const xPos = padLeft + ((val - 1) / 199) * pw;
          ctx.beginPath();
          ctx.strokeStyle = val === 64 || val === 128 ? "rgba(0, 240, 255, 0.45)" : "rgba(255, 255, 255, 0.08)";
          if (val === 64 || val === 128) ctx.setLineDash([3, 3]);
          ctx.moveTo(xPos, padTop);
          ctx.lineTo(xPos, padTop + ph);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.beginPath();
          ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
          ctx.moveTo(xPos, padTop + ph);
          ctx.lineTo(xPos, padTop + ph + 5);
          ctx.stroke();

          ctx.textAlign = "center";
          ctx.font = val === 64 ? "bold 10px 'JetBrains Mono', monospace" : "10px 'JetBrains Mono', monospace";
          ctx.fillStyle = val === 64 ? "#00f0ff" : "#94a3b8";
          ctx.fillText("n=" + val, xPos, padTop + ph + 18);
        });

        ctx.textAlign = "center";
        ctx.font = "11px 'JetBrains Mono', monospace";
        ctx.fillStyle = "#ffffff";
        ctx.fillText("Vector Length n (elements)", w / 2, h - 14);

        // Vibrant Multi-Stop Area Gradient Fill
        const areaGrad = ctx.createLinearGradient(0, padTop, 0, padTop + ph);
        areaGrad.addColorStop(0.0, "rgba(0, 240, 255, 0.35)");  // Cyan peak
        areaGrad.addColorStop(0.4, "rgba(0, 255, 136, 0.20)");  // Emerald mid
        areaGrad.addColorStop(0.75, "rgba(245, 158, 11, 0.12)"); // Amber baseline
        areaGrad.addColorStop(1.0, "rgba(0, 0, 0, 0.0)");

        ctx.beginPath();
        for (let n = 1; n <= 200; n++) {
          const sc = 5 * n;
          const vc = Math.ceil(n / 64) * 12 + n;
          const spd = sc / vc;
          const x = padLeft + ((n - 1) / 199) * pw;
          const y = padTop + ph - (spd / 5.0) * ph;
          if (n === 1) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.lineTo(padLeft + pw, padTop + ph);
        ctx.lineTo(padLeft, padTop + ph);
        ctx.closePath();
        ctx.fillStyle = areaGrad;
        ctx.fill();

        // Multi-Color Horizontal Gradient for the Running Curve Stroke
        const strokeGrad = ctx.createLinearGradient(padLeft, 0, padLeft + pw, 0);
        strokeGrad.addColorStop(0.00, "#f59e0b"); // Amber for deficit zone (n < 3)
        strokeGrad.addColorStop(0.12, "#38bdf8"); // Sky blue ramp
        strokeGrad.addColorStop(0.32, "#00f0ff"); // Cyan peak at 64
        strokeGrad.addColorStop(0.34, "#fbbf24"); // Amber sawtooth drop at 65
        strokeGrad.addColorStop(0.55, "#00ff88"); // Emerald Chunk 2
        strokeGrad.addColorStop(0.64, "#00f0ff"); // Cyan peak at 128
        strokeGrad.addColorStop(0.66, "#fbbf24"); // Amber drop at 129
        strokeGrad.addColorStop(0.85, "#2dd4bf"); // Mint / Turquoise Chunk 3
        strokeGrad.addColorStop(1.00, "#00ff88"); // Emerald saturation

        // Outer Neon Glow Pass
        ctx.save();
        ctx.shadowColor = "#00f0ff";
        ctx.shadowBlur = 14;
        ctx.strokeStyle = strokeGrad;
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let n = 1; n <= 200; n++) {
          const sc = 5 * n;
          const vc = Math.ceil(n / 64) * 12 + n;
          const spd = sc / vc;
          const x = padLeft + ((n - 1) / 199) * pw;
          const y = padTop + ph - (spd / 5.0) * ph;
          if (n === 1) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();

        // Inner Sharp Crisp Pass
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let n = 1; n <= 200; n++) {
          const sc = 5 * n;
          const vc = Math.ceil(n / 64) * 12 + n;
          const spd = sc / vc;
          const x = padLeft + ((n - 1) / 199) * pw;
          const y = padTop + ph - (spd / 5.0) * ph;
          if (n === 1) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // 1.0x Baseline Callout (Amber Badge)
        const yBase = padTop + ph - (1.0 / 5.0) * ph;
        ctx.fillStyle = "rgba(24, 18, 10, 0.95)";
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(padLeft + 15, yBase - 18, 145, 16, 4);
        ctx.fill();
        ctx.stroke();
        ctx.font = "bold 9px 'JetBrains Mono', monospace";
        ctx.fillStyle = "#fbbf24";
        ctx.textAlign = "center";
        ctx.fillText("⚡ 1.0x SCALAR BASELINE", padLeft + 87, yBase - 6);

        // Animated Traveling Energy Photons along the Curve!
        const numPhotons = 4;
        const photonColors = ["#00f0ff", "#00ff88", "#fbbf24", "#e879f9"];
        for (let k = 0; k < numPhotons; k++) {
          const photonProg = ((animTime * 0.16 + k * 0.25) % 1.0);
          const pN = 1 + photonProg * 199;
          const pSc = 5 * pN;
          const pVc = Math.ceil(pN / 64) * 12 + pN;
          const pSpd = pSc / pVc;
          const px = padLeft + ((pN - 1) / 199) * pw;
          const py = padTop + ph - (pSpd / 5.0) * ph;

          ctx.save();
          ctx.shadowColor = photonColors[k % photonColors.length];
          ctx.shadowBlur = 12;
          ctx.fillStyle = photonColors[k % photonColors.length];
          ctx.beginPath();
          ctx.arc(px, py, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(px, py, 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // n=1 Scalar Advantage Point
        const x1 = padLeft;
        const y1 = padTop + ph - ((5 / 13) / 5.0) * ph;
        ctx.beginPath();
        ctx.arc(x1, y1, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = "#fbbf24";
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.font = "bold 9px 'JetBrains Mono', monospace";
        ctx.fillStyle = "#fbbf24";
        ctx.textAlign = "left";
        ctx.fillText("n=1: 0.38x (Scalar wins)", x1 + 10, y1 + 14);

        // n=64 Peak point with pulsing beacon
        const x64 = padLeft + ((64 - 1) / 199) * pw;
        const y64 = padTop + ph - ((320 / 76) / 5.0) * ph;
        ctx.beginPath();
        ctx.arc(x64, y64, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#00f0ff";
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.font = "bold 9.5px 'JetBrains Mono', monospace";
        ctx.fillStyle = "#00f0ff";
        ctx.textAlign = "center";
        ctx.fillText("n=64: 4.21x (Chunk 1 Peak)", x64 - 15, y64 - 10);

        // Sawtooth Drop Hazard Beacon at n=65
        const x65 = padLeft + ((65 - 1) / 199) * pw;
        const y65 = padTop + ph - ((325 / 91) / 5.0) * ph;
        const beaconPulse = Math.sin(animTime * 6) * 2;
        ctx.beginPath();
        ctx.arc(x65, y65, 4 + beaconPulse, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(245, 158, 11, 0.75)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x65, y65, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#fbbf24";
        ctx.fill();

        ctx.font = "bold 9px 'JetBrains Mono', monospace";
        ctx.fillStyle = "#fbbf24";
        ctx.textAlign = "left";
        ctx.fillText("⚠️ Sawtooth drop (+12c chunk)", x65 + 8, y65 + 16);

        // Live Animated Reticle Cursor at current N
        const curX = padLeft + ((currentN - 1) / 199) * pw;
        const curSc = 5 * currentN;
        const curVc = Math.ceil(currentN / 64) * 12 + currentN;
        const curSpd = (curSc / curVc);
        const curY = padTop + ph - (curSpd / 5.0) * ph;

        // Animated Vertical Laser Guide Line
        ctx.beginPath();
        ctx.strokeStyle = "rgba(0, 240, 255, 0.45)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.moveTo(curX, padTop);
        ctx.lineTo(curX, padTop + ph);
        ctx.stroke();
        ctx.setLineDash([]);

        // Pulsing Sonar Ring at Cursor
        const sonarR = 8 + (animTime * 14 % 12);
        const sonarAlpha = 1 - (sonarR - 8) / 12;
        ctx.beginPath();
        ctx.arc(curX, curY, sonarR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0, 240, 255, ${sonarAlpha})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.save();
        ctx.shadowColor = "#00f0ff";
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(curX, curY, 6, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.strokeStyle = "#00f0ff";
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.restore();

        // High-Contrast Callout Pill
        const pillText = `n=${currentN}: ${curSpd.toFixed(2)}x (${curVc}c Vector vs ${curSc}c Scalar)`;
        ctx.font = "bold 9.5px 'JetBrains Mono', monospace";
        const tw = ctx.measureText(pillText).width;
        let px = curX - (tw + 16) / 2;
        px = Math.max(padLeft + 4, Math.min(padLeft + pw - tw - 20, px));
        let py = curY - 32;
        if (py < padTop + 4) py = curY + 14;

        ctx.fillStyle = "rgba(10, 14, 20, 0.95)";
        ctx.strokeStyle = "#00f0ff";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.roundRect(px, py, tw + 16, 22, 4);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = "center";
        ctx.fillStyle = "#00f0ff";
        ctx.fillText(pillText, px + (tw + 16) / 2, py + 15);

      } else if (currentMode === 'amdahl') {
        // ==========================================
        // MODE 2: AMDAHL'S LAW TELEMETRY
        // Vivid Neon Multi-Processor Curves
        // ==========================================
        ctx.textAlign = "center";
        ctx.font = "bold 13px 'Orbitron', monospace";
        ctx.fillStyle = "#ffffff";
        ctx.fillText("AMDAHL'S LAW: SPEEDUP vs VECTORIZABLE FRACTION (f)", w / 2, 26);

        ctx.font = "10px 'JetBrains Mono', monospace";
        ctx.fillStyle = "#00ff88";
        ctx.fillText("THEORETICAL MAXIMUM SYSTEM ACCELERATION // S(f) = 1 / ((1-f) + f/P)", w / 2, 42);

        // Y-axis (0x to 20x)
        for (let tick = 0; tick <= 20; tick += 5) {
          const yPos = padTop + ph - (tick / 20.0) * ph;
          ctx.beginPath();
          ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
          ctx.moveTo(padLeft, yPos);
          ctx.lineTo(padLeft + pw, yPos);
          ctx.stroke();

          ctx.textAlign = "right";
          ctx.font = "10px 'JetBrains Mono', monospace";
          ctx.fillStyle = "#94a3b8";
          ctx.fillText(tick + "x", padLeft - 10, yPos + 3.5);
        }

        ctx.save();
        ctx.translate(18, padTop + ph / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = "center";
        ctx.fillStyle = "#38bdf8";
        ctx.font = "10px 'JetBrains Mono', monospace";
        ctx.fillText("Overall Speedup S(f)", 0, 0);
        ctx.restore();

        // X-axis (0% to 100%)
        const fTicks = [0, 20, 40, 60, 80, 100];
        fTicks.forEach(val => {
          const xPos = padLeft + (val / 100) * pw;
          ctx.beginPath();
          ctx.strokeStyle = val === 90 ? "rgba(245, 158, 11, 0.45)" : "rgba(255, 255, 255, 0.08)";
          ctx.moveTo(xPos, padTop);
          ctx.lineTo(xPos, padTop + ph);
          ctx.stroke();

          ctx.beginPath();
          ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
          ctx.moveTo(xPos, padTop + ph);
          ctx.lineTo(xPos, padTop + ph + 5);
          ctx.stroke();

          ctx.textAlign = "center";
          ctx.font = val === 90 ? "bold 10px 'JetBrains Mono', monospace" : "10px 'JetBrains Mono', monospace";
          ctx.fillStyle = val === 90 ? "#fbbf24" : "#94a3b8";
          ctx.fillText(val + "%", xPos, padTop + ph + 18);
        });

        ctx.textAlign = "center";
        ctx.font = "11px 'JetBrains Mono', monospace";
        ctx.fillStyle = "#ffffff";
        ctx.fillText("Vectorizable Fraction f (%)", w / 2, h - 14);

        // Distinct Vivid Neon Colors for Processor Curves
        const factors = [
          { p: 4, col: "#38bdf8", label: "P = 4 (Sky Blue)" },
          { p: 8, col: "#06b6d4", label: "P = 8 (Cyan)" },
          { p: 16, col: "#00ff88", label: "P = 16 (Emerald)" },
          { p: 64, col: "#a855f7", label: "P = 64 (Neon Violet)" },
          { p: Infinity, col: "#fbbf24", label: "P = ∞ (Amdahl Limit)" }
        ];

        factors.forEach(curve => {
          ctx.beginPath();
          for (let f = 0; f <= 95; f++) {
            const fDec = f / 100;
            const spd = curve.p === Infinity ? (1 / (1 - fDec)) : (1 / ((1 - fDec) + fDec / curve.p));
            const clamped = Math.min(20, spd);
            const x = padLeft + (f / 100) * pw;
            const y = padTop + ph - (clamped / 20.0) * ph;
            if (f === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = curve.col;
          ctx.lineWidth = curve.p === 16 || curve.p === Infinity ? 2.5 : 1.5;
          if (curve.p === Infinity) {
            ctx.setLineDash([6, 4]);
            ctx.lineDashOffset = -animTime * 18; // Marching dashed limit!
          }
          ctx.stroke();
          ctx.setLineDash([]);

          // Running Energy Spark along each curve!
          const sparkProg = ((animTime * 0.12 + curve.p * 0.05) % 1.0);
          const sf = sparkProg * 95;
          const sfDec = sf / 100;
          const sSpd = curve.p === Infinity ? (1 / (1 - sfDec)) : (1 / ((1 - sfDec) + sfDec / curve.p));
          const sx = padLeft + (sf / 100) * pw;
          const sy = padTop + ph - (Math.min(20, sSpd) / 20.0) * ph;

          ctx.save();
          ctx.shadowColor = curve.col;
          ctx.shadowBlur = 10;
          ctx.fillStyle = curve.col;
          ctx.beginPath();
          ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });

        // Top Legend Bar with Color Tags
        let legX = padLeft + 14;
        const legY = padTop + 18;
        factors.forEach(curve => {
          ctx.fillStyle = curve.col;
          ctx.fillRect(legX, legY, 12, 4);
          ctx.font = "bold 8.5px 'JetBrains Mono', monospace";
          ctx.textAlign = "left";
          ctx.fillText(curve.label, legX + 16, legY + 5);
          legX += 105;
        });

        // Dynamic Active Cursor
        const curX = padLeft + (currentF / 100) * pw;
        const curFDecVal = currentF / 100;
        const sInf = (1 / (1 - curFDecVal));
        const s16 = (1 / ((1 - curFDecVal) + curFDecVal / 16));
        const yInf = padTop + ph - (Math.min(20, sInf) / 20.0) * ph;
        const y16 = padTop + ph - (Math.min(20, s16) / 20.0) * ph;

        ctx.beginPath();
        ctx.strokeStyle = "rgba(245, 158, 11, 0.45)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.moveTo(curX, padTop);
        ctx.lineTo(curX, padTop + ph);
        ctx.stroke();
        ctx.setLineDash([]);

        // Dual Markers on P=16 and P=Infinity
        ctx.beginPath();
        ctx.arc(curX, yInf, 5.5, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(curX, y16, 5.5, 0, Math.PI * 2);
        ctx.fillStyle = "#00ff88";
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Callout Pill
        const aPillText = `f=${currentF}%: P=16 → ${s16.toFixed(2)}x | P=∞ → ${sInf.toFixed(2)}x`;
        ctx.font = "bold 9.5px 'JetBrains Mono', monospace";
        const atw = ctx.measureText(aPillText).width;
        let apx = curX - (atw + 16) / 2;
        apx = Math.max(padLeft + 4, Math.min(padLeft + pw - atw - 20, apx));
        let apy = Math.min(yInf, y16) - 30;
        if (apy < padTop + 4) apy = Math.max(yInf, y16) + 14;

        ctx.fillStyle = "rgba(14, 15, 18, 0.95)";
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.roundRect(apx, apy, atw + 16, 22, 4);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = "center";
        ctx.fillStyle = "#fbbf24";
        ctx.fillText(aPillText, apx + (atw + 16) / 2, apy + 15);

      } else {
        // ==========================================
        // MODE 3: ROOFLINE MODEL TELEMETRY
        // Memory-Bound vs Compute-Bound Dynamic Zones
        // ==========================================
        ctx.textAlign = "center";
        ctx.font = "bold 13px 'Orbitron', monospace";
        ctx.fillStyle = "#ffffff";
        ctx.fillText("ROOFLINE MODEL: ATTAINABLE GFLOP/s vs ARITHMETIC INTENSITY", w / 2, 26);

        ctx.font = "10px 'JetBrains Mono', monospace";
        ctx.fillStyle = "#00f0ff";
        ctx.fillText("MEMORY BANDWIDTH CEILING (SLANTED) vs SIMD COMPUTE SATURATION (FLAT)", w / 2, 42);

        // Y-axis (0 to 120 GFLOP/s)
        for (let tick = 0; tick <= 120; tick += 30) {
          const yPos = padTop + ph - (tick / 120.0) * ph;
          ctx.beginPath();
          ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
          ctx.moveTo(padLeft, yPos);
          ctx.lineTo(padLeft + pw, yPos);
          ctx.stroke();

          ctx.textAlign = "right";
          ctx.font = "10px 'JetBrains Mono', monospace";
          ctx.fillStyle = "#94a3b8";
          ctx.fillText(tick + " GF", padLeft - 10, yPos + 3.5);
        }

        ctx.save();
        ctx.translate(18, padTop + ph / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = "center";
        ctx.fillStyle = "#38bdf8";
        ctx.font = "10px 'JetBrains Mono', monospace";
        ctx.fillText("Attainable Performance (GFLOP/s)", 0, 0);
        ctx.restore();

        // X-axis log scale (0.05 to 8.0 FLOPs / Byte)
        const minI = 0.05;
        const maxI = 8.0;
        const xMap = (val) => padLeft + (Math.log2(val / minI) / Math.log2(maxI / minI)) * pw;
        const xTicks = [0.0625, 0.125, 0.25, 0.5, 1.0, 2.0, 4.0, 8.0];

        xTicks.forEach(val => {
          const xPos = xMap(val);
          ctx.beginPath();
          ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
          ctx.moveTo(xPos, padTop);
          ctx.lineTo(xPos, padTop + ph);
          ctx.stroke();

          ctx.textAlign = "center";
          ctx.font = "10px 'JetBrains Mono', monospace";
          ctx.fillStyle = "#94a3b8";
          ctx.fillText(val >= 1 ? val.toFixed(1) : `${val}`, xPos, padTop + ph + 18);
        });

        ctx.textAlign = "center";
        ctx.font = "11px 'JetBrains Mono', monospace";
        ctx.fillStyle = "#ffffff";
        ctx.fillText("Arithmetic Intensity (FLOPs / Byte, Log Scale)", w / 2, h - 14);

        const kneeI = peakCompute / memBandwidth; // 1.5 FLOP/B
        const kneeX = xMap(kneeI);
        const kneeY = padTop + ph - (peakCompute / 120.0) * ph;

        // Shaded Memory-Bound Zone (Amber / Coral)
        ctx.fillStyle = "rgba(245, 158, 11, 0.08)";
        ctx.beginPath();
        ctx.moveTo(xMap(minI), padTop + ph);
        ctx.lineTo(xMap(minI), padTop + ph - ((minI * memBandwidth) / 120.0) * ph);
        ctx.lineTo(kneeX, kneeY);
        ctx.lineTo(kneeX, padTop + ph);
        ctx.closePath();
        ctx.fill();

        // Shaded Compute-Bound Zone (Cyan / Emerald)
        ctx.fillStyle = "rgba(0, 240, 255, 0.08)";
        ctx.beginPath();
        ctx.moveTo(kneeX, padTop + ph);
        ctx.lineTo(kneeX, kneeY);
        ctx.lineTo(xMap(maxI), kneeY);
        ctx.lineTo(xMap(maxI), padTop + ph);
        ctx.closePath();
        ctx.fill();

        // Zone Annotations
        ctx.font = "bold 9px 'JetBrains Mono', monospace";
        ctx.fillStyle = "#fbbf24";
        ctx.textAlign = "center";
        ctx.fillText("⚡ MEMORY BOUND REGION", (padLeft + kneeX) / 2, padTop + ph - 25);

        ctx.fillStyle = "#00ff88";
        ctx.fillText("🚀 COMPUTE BOUND REGION", (kneeX + padLeft + pw) / 2, padTop + ph - 25);

        // Slanted Memory Line with Gradient (Amber to Cyan)
        const slantGrad = ctx.createLinearGradient(xMap(minI), padTop + ph, kneeX, kneeY);
        slantGrad.addColorStop(0, "#fbbf24");
        slantGrad.addColorStop(1, "#00f0ff");

        ctx.save();
        ctx.shadowColor = "#00f0ff";
        ctx.shadowBlur = 12;
        ctx.strokeStyle = slantGrad;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(xMap(minI), padTop + ph - ((minI * memBandwidth) / 120.0) * ph);
        ctx.lineTo(kneeX, kneeY);
        ctx.stroke();

        // Flat Compute Saturation Ceiling (Neon Emerald)
        ctx.strokeStyle = "#00ff88";
        ctx.shadowColor = "#00ff88";
        ctx.beginPath();
        ctx.moveTo(kneeX, kneeY);
        ctx.lineTo(xMap(maxI), kneeY);
        ctx.stroke();
        ctx.restore();

        // Flowing Particles Along the Roofline!
        const rfProg = (animTime * 0.18) % 1.0;
        let rfx, rfy;
        if (rfProg < 0.5) {
          const tSub = rfProg / 0.5;
          rfx = xMap(minI) + tSub * (kneeX - xMap(minI));
          rfy = (padTop + ph - ((minI * memBandwidth) / 120.0) * ph) + tSub * (kneeY - (padTop + ph - ((minI * memBandwidth) / 120.0) * ph));
        } else {
          const tSub = (rfProg - 0.5) / 0.5;
          rfx = kneeX + tSub * (xMap(maxI) - kneeX);
          rfy = kneeY;
        }

        ctx.save();
        ctx.shadowColor = "#ffffff";
        ctx.shadowBlur = 14;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(rfx, rfy, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Pulsing Knee Point
        const kneePulse = Math.sin(animTime * 5) * 2;
        ctx.beginPath();
        ctx.arc(kneeX, kneeY, 6 + kneePulse, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(251, 191, 36, 0.75)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(kneeX, kneeY, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = "#fbbf24";
        ctx.fill();
        ctx.font = "bold 9.5px 'JetBrains Mono', monospace";
        ctx.fillStyle = "#fbbf24";
        ctx.textAlign = "center";
        ctx.fillText(`Knee: ${kneeI.toFixed(2)} FLOP/B`, kneeX, kneeY - 12);

        // Active Operational Marker
        const curIntensityVal = Math.max(minI, Math.min(maxI, currentIntensity));
        const curAttainable = Math.min(peakCompute, curIntensityVal * memBandwidth);
        const curIsMem = curIntensityVal < (peakCompute / memBandwidth);

        const curX = xMap(curIntensityVal);
        const curY = padTop + ph - (curAttainable / 120.0) * ph;

        ctx.beginPath();
        ctx.strokeStyle = curIsMem ? "rgba(245, 158, 11, 0.55)" : "rgba(0, 240, 255, 0.55)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.moveTo(curX, padTop);
        ctx.lineTo(curX, padTop + ph);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.save();
        ctx.shadowColor = curIsMem ? "#fbbf24" : "#00ff88";
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(curX, curY, 6, 0, Math.PI * 2);
        ctx.fillStyle = curIsMem ? "#fbbf24" : "#00ff88";
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();

        // Callout Pill
        const pillText = `Intensity: ${curIntensityVal.toFixed(2)} FLOP/B → ${curAttainable.toFixed(1)} GFLOP/s (${curIsMem ? 'MEMORY BOUND' : 'COMPUTE BOUND'})`;
        ctx.font = "bold 9.5px 'JetBrains Mono', monospace";
        const rtw = ctx.measureText(pillText).width;
        let rpx = curX - (rtw + 16) / 2;
        rpx = Math.max(padLeft + 4, Math.min(padLeft + pw - rtw - 20, rpx));
        let rpy = curY - 30;
        if (rpy < padTop + 4) rpy = curY + 14;

        ctx.fillStyle = "rgba(10, 14, 20, 0.95)";
        ctx.strokeStyle = curIsMem ? "#fbbf24" : "#00ff88";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.roundRect(rpx, rpy, rtw + 16, 22, 4);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = "center";
        ctx.fillStyle = curIsMem ? "#fbbf24" : "#00ff88";
        ctx.fillText(pillText, rpx + (rtw + 16) / 2, rpy + 15);
      }

      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    setHoverPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleMouseLeave = () => {
    setHoverPos(null);
  };

  return (
    <section>
      <div className="cyber-card">
        {/* Header HUD */}
        <div className="card-header-hud">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h3><span>📈</span> THEORETICAL ACCELERATION TELEMETRY</h3>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              className={`icon-btn ${graphMode === 'length' ? 'active' : ''}`}
              onClick={() => handleModeSwitch('length')}
              style={{ fontSize: '0.75rem', padding: '6px 14px' }}
            >
              STARTUP AMORTISATION
            </button>
            <button
              className={`icon-btn ${graphMode === 'amdahl' ? 'active' : ''}`}
              onClick={() => handleModeSwitch('amdahl')}
              style={{ fontSize: '0.75rem', padding: '6px 14px' }}
            >
              AMDAHL'S LAW
            </button>
            <button
              className={`icon-btn ${graphMode === 'roofline' ? 'active' : ''}`}
              onClick={() => handleModeSwitch('roofline')}
              style={{ fontSize: '0.75rem', padding: '6px 14px' }}
            >
              📊 ROOFLINE MODEL
            </button>
          </div>
        </div>

        {/* Interactive Controls Bar with Auto-Scan Toggle */}
        <div style={{
          display: 'flex',
          gap: '16px',
          alignItems: 'center',
          marginBottom: '14px',
          background: 'rgba(10, 14, 20, 0.95)',
          padding: '10px 16px',
          borderRadius: '8px',
          border: '1px solid var(--border-neon)',
          flexWrap: 'wrap'
        }}>
          {graphMode === 'length' && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px', minWidth: '320px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#00f0ff', whiteSpace: 'nowrap' }}>
                INTERACTIVE LENGTH (n):
              </span>
              <input
                type="range"
                min="1"
                max="200"
                value={nVal}
                onChange={(e) => handleNSlider(e.target.value)}
                style={{ marginBottom: 0, flex: 1, accentColor: '#00f0ff' }}
              />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 700, color: '#fff', minWidth: '55px' }}>
                n = {nVal}
              </span>
            </div>
          )}

          {graphMode === 'amdahl' && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px', minWidth: '320px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#fbbf24', whiteSpace: 'nowrap' }}>
                VECTORIZABLE FRACTION (f):
              </span>
              <input
                type="range"
                min="0"
                max="95"
                value={fVal}
                onChange={(e) => handleFSlider(e.target.value)}
                style={{ marginBottom: 0, flex: 1, accentColor: '#fbbf24' }}
              />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 700, color: '#fff', minWidth: '55px' }}>
                f = {fVal}%
              </span>
            </div>
          )}

          {graphMode === 'roofline' && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px', minWidth: '320px', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: isMemoryBound ? '#fbbf24' : '#00ff88', whiteSpace: 'nowrap' }}>
                ARITHMETIC INTENSITY:
              </span>
              <input
                type="range"
                min="0.05"
                max="8.0"
                step="0.05"
                value={intensity}
                onChange={(e) => handleIntensitySlider(e.target.value)}
                style={{ marginBottom: 0, flex: 1, accentColor: isMemoryBound ? '#fbbf24' : '#00ff88' }}
              />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 700, color: '#fff', minWidth: '85px' }}>
                {intensity.toFixed(2)} FLOP/B
              </span>

              {/* Quick Presets */}
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  type="button"
                  className="icon-btn"
                  style={{ fontSize: '0.65rem', padding: '2px 6px' }}
                  onClick={() => setIntensityPreset(0.125)}
                >
                  Vector Add
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  style={{ fontSize: '0.65rem', padding: '2px 6px' }}
                  onClick={() => setIntensityPreset(0.25)}
                >
                  Stencil
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  style={{ fontSize: '0.65rem', padding: '2px 6px' }}
                  onClick={() => setIntensityPreset(1.25)}
                >
                  FFT
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  style={{ fontSize: '0.65rem', padding: '2px 6px' }}
                  onClick={() => setIntensityPreset(4.0)}
                >
                  Dense GEMM
                </button>
              </div>
            </div>
          )}

          {/* Auto-Scan Sweep Button */}
          <button
            type="button"
            className="cyber-btn"
            style={{
              padding: '4px 12px',
              fontSize: '0.72rem',
              borderColor: autoScan ? '#00f0ff' : 'rgba(255,255,255,0.2)',
              background: autoScan ? 'rgba(0, 240, 255, 0.22)' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onClick={toggleAutoScan}
          >
            <span style={{ color: autoScan ? '#00f0ff' : '#94a3b8' }}>{autoScan ? '⚡' : '⏸'}</span>
            <span>{autoScan ? 'AUTO-SWEEP: ON' : 'AUTO-SWEEP: OFF'}</span>
          </button>

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: '#00ff88', whiteSpace: 'nowrap' }}>
            {graphMode === 'length' && (
              <>SPEEDUP: <strong style={{ color: '#00f0ff' }}>{curLengthSpd}x</strong> ({curVector}c Vector vs {curScalar}c Scalar)</>
            )}
            {graphMode === 'amdahl' && (
              <>SPEEDUP: P=16 → <strong style={{ color: '#00ff88' }}>{curAmdahl16}x</strong> | P=∞ Limit → <strong style={{ color: '#fbbf24' }}>{curAmdahlInf}x</strong></>
            )}
            {graphMode === 'roofline' && (
              <>PERF: <strong style={{ color: isMemoryBound ? '#fbbf24' : '#00ff88' }}>{attainablePerf.toFixed(1)} GFLOP/s</strong> / {peakCompute} GF Peak</>
            )}
          </div>
        </div>

        {/* Dynamic Running Canvas Chart */}
        <canvas
          ref={canvasRef}
          id="chartCanvas"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />

        {/* Insight Cards */}
        <div className="layout-2col" style={{ marginTop: '20px' }}>
          <div style={{ background: 'rgba(14, 15, 18, 0.92)', border: '1px solid var(--border-neon)', borderRadius: '8px', padding: '16px' }}>
            <h4 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: '#00ff88', letterSpacing: '1px' }}>
              {graphMode === 'roofline' ? 'INSIGHT 1: MEMORY vs COMPUTE BOUNDARY' : 'INSIGHT 1: STARTUP AMORTISATION CURVE'}
            </h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.6 }}>
              {graphMode === 'roofline'
                ? "The ridge point (Knee = 1.5 FLOP/B) separates memory-bound workloads (e.g. SAXPY, Stencils) from compute-bound workloads (e.g. Matrix Multiply). Low-intensity loops starve SIMD ALUs regardless of vector width!"
                : "For small arrays (n < 3), Scalar Processor wins because Vector pipelining startup (12 cycles) is not yet amortized. As n reaches 64, speedup hits peak (4.21×). Notice the strip-mining sawtooth at n = 65 where a second 12-cycle chunk startup is incurred."}
            </p>
          </div>

          <div style={{ background: 'rgba(14, 15, 18, 0.92)', border: '1px solid var(--border-neon)', borderRadius: '8px', padding: '16px' }}>
            <h4 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: '#fbbf24', letterSpacing: '1px' }}>
              {graphMode === 'roofline' ? 'INSIGHT 2: HARDWARE BANDWIDTH SATURATION' : "INSIGHT 2: AMDAHL'S LAW SERIAL BOTTLENECK"}
            </h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.6 }}>
              {graphMode === 'roofline'
                ? "To escape the slanted memory ceiling and achieve peak SIMD throughput, kernels must apply algorithmic transformations: register blocking, loop fusion, and spatial cache tiling to reuse operands in registers."
                : "Formula: S(f) = 1 / ((1 - f) + f / P). Even with an infinite supercomputer (P → ∞), if 10% of code is sequential (f = 90%), total speedup is strictly capped at 10×. The serial fraction always dominates."}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
