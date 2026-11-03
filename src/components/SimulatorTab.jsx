import React, { useState, useEffect, useRef } from 'react';
import { playCyberBeep } from '../utils/sound';

export default function SimulatorTab({ onUpdateCycles, initialKernel = 'add' }) {
  const [kernel, setKernel] = useState(initialKernel);
  const [n, setN] = useState(64);
  const [peCount, setPeCount] = useState(8);
  const [topology, setTopology] = useState('1d'); // '1d' or '2d_mesh'
  const [isPlaying, setIsPlaying] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [simSpeed, setSimSpeed] = useState(2);
  const [currentCycles, setCurrentCycles] = useState(0);
  const [showRace, setShowRace] = useState(false);
  const [raceActive, setRaceActive] = useState(false);
  const [raceProgress, setRaceProgress] = useState({ scalar: 0, vector: 0, array: 0, finished: false });

  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const packetProgressRef = useRef(0);
  const raceAnimRef = useRef(null);

  const isStencil = kernel === 'stencil';
  const effectiveN = isStencil ? Math.max(1, n - 2) : n;
  const totalSteps = Math.ceil(n / peCount);

  // Cycle formulas
  const scalarCycles = isStencil ? 5 * (n - 2) : 5 * n;
  const numChunks = Math.ceil(effectiveN / 64);
  const vectorCycles = isStencil ? (numChunks * 14 + (n - 2)) : (numChunks * 12 + n);
  const targetArrayCycles = totalSteps * (isStencil ? 9 : 3);

  // Update parent top bar telemetry cycles
  useEffect(() => {
    if (onUpdateCycles) {
      onUpdateCycles(currentCycles, peCount);
    }
  }, [currentCycles, peCount, onUpdateCycles]);

  // Reset when configuration changes
  useEffect(() => {
    setIsPlaying(false);
    setStepIndex(0);
    setCurrentCycles(0);
    packetProgressRef.current = 0;
  }, [kernel, n, peCount]);

  // Reset topology to 1D if peCount is not 16
  useEffect(() => {
    if (peCount !== 16 && topology === '2d_mesh') {
      setTopology('1d');
    }
  }, [peCount, topology]);

  // Strip mining chunks
  const chunks = [];
  let rem = effectiveN;
  let cIdx = 0;
  while (rem > 0) {
    const chunkLen = Math.min(64, rem);
    const start = cIdx * 64;
    const end = start + chunkLen;
    const cyc = (isStencil ? 14 : 12) + chunkLen;
    chunks.push({
      idx: cIdx,
      start,
      end,
      len: chunkLen,
      cycles: cyc,
      isActive: Math.floor((stepIndex * peCount) / 64) === cIdx
    });
    rem -= chunkLen;
    cIdx++;
  }

  // Time-travel Cycle Scrubber Handler
  const handleScrubCycles = (scrubCyc) => {
    setIsPlaying(false);
    const clamped = Math.max(0, Math.min(targetArrayCycles, scrubCyc));
    setCurrentCycles(clamped);
    const step = Math.min(totalSteps - 1, Math.floor((clamped / targetArrayCycles) * totalSteps));
    setStepIndex(step);
    packetProgressRef.current = (clamped % (isStencil ? 9 : 3)) / (isStencil ? 9 : 3);
    playCyberBeep(450 + scrubCyc * 10, 'sine', 0.02);
  };

  // Side-by-Side Hardware Drag Race
  const startRace = () => {
    setRaceActive(true);
    setRaceProgress({ scalar: 0, vector: 0, array: 0, finished: false });
    playCyberBeep(880, 'triangle', 0.15);

    let cyc = 0;
    const maxCyc = Math.max(scalarCycles, vectorCycles, targetArrayCycles);

    const raceTick = () => {
      cyc += 2;
      const sProg = Math.min(100, (Math.floor(cyc / 5) / n) * 100);
      const vProg = cyc < 12 ? 0 : Math.min(100, ((cyc - 12) / n) * 100);
      const arrStepDuration = isStencil ? 9 : 3;
      const aSteps = Math.floor(cyc / arrStepDuration);
      const aProg = Math.min(100, ((aSteps * peCount) / n) * 100);

      const allDone = sProg >= 100 && vProg >= 100 && aProg >= 100;

      setRaceProgress({
        scalar: sProg,
        vector: vProg,
        array: aProg,
        finished: allDone
      });

      if (!allDone && cyc < maxCyc + 30) {
        raceAnimRef.current = requestAnimationFrame(raceTick);
      } else {
        setRaceActive(false);
        playCyberBeep(1200, 'triangle', 0.25);
      }
    };

    raceAnimRef.current = requestAnimationFrame(raceTick);
  };

  useEffect(() => {
    return () => {
      if (raceAnimRef.current) cancelAnimationFrame(raceAnimRef.current);
    };
  }, []);

  // Canvas drawing loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const isLargePE = peCount > 8;
      const is2DMesh = topology === '2d_mesh' && peCount === 16;
      const h = is2DMesh ? 380 : (isLargePE ? 360 : 300);
      const dpr = window.devicePixelRatio || 1;

      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.height = `${h}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      ctx.clearRect(0, 0, w, h);

      // Status Banner
      ctx.font = "bold 11px 'JetBrains Mono', monospace";
      ctx.fillStyle = isStencil ? "#fbbf24" : "#00ff88";
      ctx.textAlign = "left";
      ctx.fillText(isPlaying ? `▶ RUNNING: STEP ${stepIndex + 1} OF ${totalSteps}` : `⏸ STEP ${stepIndex + 1} OF ${totalSteps}`, 20, 22);

      ctx.textAlign = "right";
      ctx.fillStyle = "#00ff88";
      ctx.fillText(`CYCLE PROGRESS: ${currentCycles} / ${targetArrayCycles} CYCLES`, w - 20, 22);

      const cuX = w / 2;
      const cuY = 46;

      // Draw Control Unit (CU)
      ctx.fillStyle = "rgba(14, 15, 18, 0.96)";
      ctx.strokeStyle = isStencil ? "#fbbf24" : "#00ff88";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(cuX - 110, cuY - 20, 220, 38, 8);
      ctx.fill();
      ctx.stroke();

      ctx.font = "bold 10.5px 'JetBrains Mono', monospace";
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.fillText("CONTROL UNIT (CU)", cuX, cuY - 2);

      ctx.font = "9px 'JetBrains Mono', monospace";
      ctx.fillStyle = isStencil ? "#fbbf24" : "#00ff88";
      ctx.fillText(isStencil ? "BROADCAST: 1D STENCIL OPERANDS" : "BROADCAST: C[i] = A[i] + B[i]", cuX, cuY + 12);

      if (!is2DMesh) {
        // ==========================================
        // 1D LINEAR BUS TOPOLOGY
        // ==========================================
        const marginX = isLargePE ? 24 : 50;
        const peSpacing = (w - marginX * 2) / (peCount - 1);
        const peRadius = isLargePE
          ? Math.max(10, Math.min(14, peSpacing * 0.35))
          : Math.max(14, Math.min(22, peSpacing * 0.40));
        const peY = h - (isLargePE ? 80 : 65);

        // Bus lines CU -> PEs
        for (let p = 0; p < peCount; p++) {
          const peX = marginX + p * peSpacing;
          ctx.beginPath();
          ctx.strokeStyle = isStencil ? "rgba(245, 158, 11, 0.25)" : "rgba(0, 255, 136, 0.25)";
          ctx.setLineDash([3, 3]);
          ctx.moveTo(cuX, cuY + 18);
          ctx.lineTo(peX, peY - peRadius - 6);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Horizontal bus
        ctx.beginPath();
        ctx.strokeStyle = isStencil ? "rgba(245, 158, 11, 0.7)" : "rgba(0, 255, 136, 0.5)";
        ctx.lineWidth = isStencil ? 3 : 1.5;
        ctx.moveTo(marginX, peY);
        ctx.lineTo(marginX + (peCount - 1) * peSpacing, peY);
        ctx.stroke();

        // Horizontal Bus Annotation
        ctx.font = isLargePE ? "bold 8px 'JetBrains Mono', monospace" : "bold 9px 'JetBrains Mono', monospace";
        ctx.fillStyle = isStencil ? "#fbbf24" : "#00ff88";
        ctx.textAlign = "center";
        ctx.fillText(
          isStencil
            ? (isLargePE ? "⚡ 16-PE INTER-NEIGHBOR ROUTING BUS (+6 CYCLES/STEP LATENCY)" : "⚡ INTER-PE NEIGHBOR ROUTING BUS (+6 CYCLES/STEP LATENCY PENALTY)")
            : (isLargePE ? "⚡ 16-PE SYNCHRONOUS BROADCAST BUS (ZERO INTER-PE LATENCY)" : "⚡ CU SYNCHRONOUS BROADCAST BUS (ZERO INTER-PE LATENCY)"),
          w / 2,
          peY - peRadius - 16
        );

        // PE Nodes
        for (let p = 0; p < peCount; p++) {
          const peX = marginX + p * peSpacing;
          const elemIdx = stepIndex * peCount + p;
          const isActive = elemIdx < n;

          ctx.beginPath();
          ctx.arc(peX, peY, peRadius, 0, Math.PI * 2);
          ctx.fillStyle = isActive ? (isStencil ? "rgba(24, 18, 10, 0.95)" : "rgba(6, 24, 14, 0.95)") : "rgba(14, 15, 18, 0.6)";
          ctx.fill();
          ctx.strokeStyle = isActive ? (isStencil ? "#fbbf24" : "#00ff88") : "#475569";
          ctx.lineWidth = isActive ? 2 : 1;
          ctx.stroke();

          ctx.font = isLargePE ? "bold 8px 'JetBrains Mono', monospace" : "bold 10px 'JetBrains Mono', monospace";
          ctx.fillStyle = isActive ? "#ffffff" : "#64748b";
          ctx.textAlign = "center";
          ctx.fillText(isLargePE ? `P${p}` : `PE ${p}`, peX, peY + (isLargePE ? 3 : 3.5));

          ctx.font = isLargePE ? "7.5px 'JetBrains Mono', monospace" : "9px 'JetBrains Mono', monospace";
          ctx.fillStyle = isActive ? (isStencil ? "#fbbf24" : "#00ff88") : "#64748b";
          ctx.fillText(isActive ? (isLargePE ? `i=${elemIdx}` : `[i=${elemIdx}]`) : (isLargePE ? `IDLE` : `[IDLE]`), peX, peY - peRadius - 6);

          if (isActive) {
            if (isLargePE) {
              const isOdd = p % 2 !== 0;
              const line1Y = isOdd ? peY + peRadius + 38 : peY + peRadius + 14;
              const line2Y = line1Y + 10;

              // Connector guide tick
              ctx.strokeStyle = isActive ? (isStencil ? "rgba(245, 158, 11, 0.35)" : "rgba(0, 255, 136, 0.35)") : "rgba(100, 116, 139, 0.2)";
              ctx.lineWidth = 1;
              ctx.setLineDash([1, 1]);
              ctx.beginPath();
              ctx.moveTo(peX, peY + peRadius + 1);
              ctx.lineTo(peX, line1Y - 8);
              ctx.stroke();
              ctx.setLineDash([]);

              ctx.font = "bold 7.5px 'JetBrains Mono', monospace";
              ctx.fillStyle = "#ffffff";

              if (!isStencil) {
                ctx.fillText(`A+B`, peX, line1Y);
                ctx.fillStyle = "#00ff88";
                ctx.fillText(`C=${(elemIdx + 1) + (elemIdx + 101)}`, peX, line2Y);
              } else {
                if (elemIdx > 0 && elemIdx < n - 1) {
                  ctx.fillText(`±1`, peX, line1Y);
                  ctx.fillStyle = "#00ff88";
                  ctx.fillText(`B=${(elemIdx - 1 + 10) + (elemIdx + 1 + 10)}`, peX, line2Y);
                } else {
                  ctx.fillStyle = "#f59e0b";
                  ctx.fillText(`HALO`, peX, line1Y);
                  ctx.fillText(`EDGE`, peX, line2Y);
                }
              }
            } else {
              ctx.font = "8.5px 'JetBrains Mono', monospace";
              ctx.fillStyle = "#ffffff";
              if (!isStencil) {
                ctx.fillText(`A:${elemIdx + 1} B:${elemIdx + 101}`, peX, peY + 34);
                ctx.fillStyle = "#00ff88";
                ctx.fillText(`C=${(elemIdx + 1) + (elemIdx + 101)}`, peX, peY + 45);
              } else {
                if (elemIdx > 0 && elemIdx < n - 1) {
                  ctx.fillText(`A[${elemIdx - 1}]+A[${elemIdx + 1}]`, peX, peY + 34);
                  ctx.fillStyle = "#00ff88";
                  ctx.fillText(`B=${(elemIdx - 1 + 10) + (elemIdx + 1 + 10)}`, peX, peY + 45);
                } else {
                  ctx.fillStyle = "#f59e0b";
                  ctx.fillText(`BOUNDARY`, peX, peY + 38);
                }
              }
            }
          }
        }

        // Packets
        if (isPlaying) {
          packetProgressRef.current += 0.02 * simSpeed;
          if (packetProgressRef.current >= 1) {
            packetProgressRef.current = 0;
            setStepIndex(prev => {
              const nextStep = prev + 1;
              if (nextStep >= totalSteps) {
                setIsPlaying(false);
                playCyberBeep(1080, 'triangle', 0.2);
                return totalSteps - 1;
              }
              playCyberBeep(720, 'sine', 0.03);
              return nextStep;
            });
            setCurrentCycles(prev => Math.min(targetArrayCycles, prev + (isStencil ? 9 : 3)));
          }

          const packetRadius = isLargePE ? 3.5 : 4.5;

          if (isStencil) {
            for (let p = 0; p < peCount - 1; p++) {
              const peX1 = marginX + p * peSpacing;
              const peX2 = marginX + (p + 1) * peSpacing;
              const px1 = peX1 + (peX2 - peX1) * packetProgressRef.current;
              ctx.beginPath();
              ctx.arc(px1, peY - 5, packetRadius, 0, Math.PI * 2);
              ctx.fillStyle = "#00ff88";
              ctx.shadowColor = "#00ff88";
              ctx.shadowBlur = 8;
              ctx.fill();
              ctx.shadowBlur = 0;

              const px2 = peX2 - (peX2 - peX1) * packetProgressRef.current;
              ctx.beginPath();
              ctx.arc(px2, peY + 5, packetRadius, 0, Math.PI * 2);
              ctx.fillStyle = "#fbbf24";
              ctx.shadowColor = "#fbbf24";
              ctx.shadowBlur = 8;
              ctx.fill();
              ctx.shadowBlur = 0;
            }
          } else {
            for (let p = 0; p < peCount; p++) {
              const peX = marginX + p * peSpacing;
              const px = cuX + (peX - cuX) * packetProgressRef.current;
              const py = (cuY + 18) + (peY - peRadius - 6 - (cuY + 18)) * packetProgressRef.current;
              ctx.beginPath();
              ctx.arc(px, py, packetRadius, 0, Math.PI * 2);
              ctx.fillStyle = "#00ff88";
              ctx.shadowColor = "#00ff88";
              ctx.shadowBlur = 8;
              ctx.fill();
              ctx.shadowBlur = 0;
            }
          }
        }
      } else {
        // ==========================================
        // 4×4 2D TORUS MESH TOPOLOGY
        // ==========================================
        const rows = 4;
        const cols = 4;
        const gridW = Math.min(w * 0.75, 420);
        const gridH = 220;
        const startX = (w - gridW) / 2;
        const startY = 110;
        const colSpacing = gridW / (cols - 1);
        const rowSpacing = gridH / (rows - 1);
        const peRadius = 15;

        // Mesh Interconnect Grid Lines
        ctx.lineWidth = 1.2;
        // Horizontal rows
        for (let r = 0; r < rows; r++) {
          const y = startY + r * rowSpacing;
          ctx.beginPath();
          ctx.strokeStyle = isStencil ? "rgba(245, 158, 11, 0.4)" : "rgba(0, 255, 136, 0.35)";
          ctx.moveTo(startX, y);
          ctx.lineTo(startX + (cols - 1) * colSpacing, y);
          ctx.stroke();
        }
        // Vertical cols
        for (let c = 0; c < cols; c++) {
          const x = startX + c * colSpacing;
          ctx.beginPath();
          ctx.strokeStyle = isStencil ? "rgba(245, 158, 11, 0.4)" : "rgba(0, 255, 136, 0.35)";
          ctx.moveTo(x, startY);
          ctx.lineTo(x, startY + (rows - 1) * rowSpacing);
          ctx.stroke();
        }

        // Broadcast lines from CU to top row
        for (let c = 0; c < cols; c++) {
          const peX = startX + c * colSpacing;
          ctx.beginPath();
          ctx.strokeStyle = "rgba(0, 255, 136, 0.2)";
          ctx.setLineDash([2, 2]);
          ctx.moveTo(cuX, cuY + 18);
          ctx.lineTo(peX, startY - peRadius);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Draw 16 PEs in 4x4 Grid
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const p = r * cols + c;
            const peX = startX + c * colSpacing;
            const peY = startY + r * rowSpacing;
            const elemIdx = stepIndex * peCount + p;
            const isActive = elemIdx < n;

            ctx.beginPath();
            ctx.arc(peX, peY, peRadius, 0, Math.PI * 2);
            ctx.fillStyle = isActive ? (isStencil ? "rgba(24, 18, 10, 0.95)" : "rgba(6, 24, 14, 0.95)") : "rgba(14, 15, 18, 0.6)";
            ctx.fill();
            ctx.strokeStyle = isActive ? (isStencil ? "#fbbf24" : "#00ff88") : "#475569";
            ctx.lineWidth = isActive ? 2 : 1;
            ctx.stroke();

            ctx.font = "bold 8.5px 'JetBrains Mono', monospace";
            ctx.fillStyle = isActive ? "#ffffff" : "#64748b";
            ctx.textAlign = "center";
            ctx.fillText(`P${p}`, peX, peY + 3);

            ctx.font = "7.5px 'JetBrains Mono', monospace";
            ctx.fillStyle = isActive ? (isStencil ? "#fbbf24" : "#00ff88") : "#64748b";
            ctx.fillText(isActive ? `i=${elemIdx}` : `IDLE`, peX, peY - peRadius - 4);
          }
        }

        // 2D Mesh Packet Routing Animation
        if (isPlaying) {
          packetProgressRef.current += 0.02 * simSpeed;
          if (packetProgressRef.current >= 1) {
            packetProgressRef.current = 0;
            setStepIndex(prev => {
              const nextStep = prev + 1;
              if (nextStep >= totalSteps) {
                setIsPlaying(false);
                playCyberBeep(1080, 'triangle', 0.2);
                return totalSteps - 1;
              }
              playCyberBeep(720, 'sine', 0.03);
              return nextStep;
            });
            setCurrentCycles(prev => Math.min(targetArrayCycles, prev + (isStencil ? 9 : 3)));
          }

          if (isStencil) {
            // Horizontal packets in 2D mesh
            for (let r = 0; r < rows; r++) {
              for (let c = 0; c < cols - 1; c++) {
                const peX1 = startX + c * colSpacing;
                const peX2 = startX + (c + 1) * colSpacing;
                const y = startY + r * rowSpacing;

                const px = peX1 + (peX2 - peX1) * packetProgressRef.current;
                ctx.beginPath();
                ctx.arc(px, y, 3, 0, Math.PI * 2);
                ctx.fillStyle = "#00ff88";
                ctx.fill();
              }
            }
            // Vertical packets in 2D mesh
            for (let c = 0; c < cols; c++) {
              for (let r = 0; r < rows - 1; r++) {
                const x = startX + c * colSpacing;
                const peY1 = startY + r * rowSpacing;
                const peY2 = startY + (r + 1) * rowSpacing;

                const py = peY1 + (peY2 - peY1) * packetProgressRef.current;
                ctx.beginPath();
                ctx.arc(x, py, 3, 0, Math.PI * 2);
                ctx.fillStyle = "#fbbf24";
                ctx.fill();
              }
            }
          } else {
            // Broadcast down to all PEs
            for (let p = 0; p < peCount; p++) {
              const r = Math.floor(p / cols);
              const c = p % cols;
              const peX = startX + c * colSpacing;
              const peY = startY + r * rowSpacing;
              const px = cuX + (peX - cuX) * packetProgressRef.current;
              const py = (cuY + 18) + (peY - peRadius - (cuY + 18)) * packetProgressRef.current;
              ctx.beginPath();
              ctx.arc(px, py, 3.5, 0, Math.PI * 2);
              ctx.fillStyle = "#00ff88";
              ctx.fill();
            }
          }
        }
      }

      if (running) {
        animRef.current = requestAnimationFrame(render);
      }
    };

    animRef.current = requestAnimationFrame(render);
    return () => {
      running = false;
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isPlaying, stepIndex, simSpeed, peCount, n, isStencil, totalSteps, targetArrayCycles, currentCycles, topology]);

  const togglePlay = () => {
    if (stepIndex >= totalSteps - 1 && !isPlaying) {
      setStepIndex(0);
      setCurrentCycles(0);
    }
    setIsPlaying(prev => !prev);
    playCyberBeep(isPlaying ? 450 : 780, 'triangle', 0.08);
  };

  const handleStep = () => {
    setIsPlaying(false);
    if (stepIndex < totalSteps - 1) {
      setStepIndex(prev => prev + 1);
      setCurrentCycles(prev => Math.min(targetArrayCycles, prev + (isStencil ? 9 : 3)));
      playCyberBeep(850, 'sine', 0.04);
    }
  };

  const handleReset = () => {
    setIsPlaying(false);
    setStepIndex(0);
    setCurrentCycles(0);
    packetProgressRef.current = 0;
    playCyberBeep(350, 'sine', 0.05);
  };

  return (
    <section>
      {/* Configuration Bar */}
      <div className="cyber-card" style={{ marginBottom: '20px' }}>
        <div className="layout-2col" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block', marginBottom: '4px' }}>
              KERNEL WORKLOAD:
            </label>
            <select value={kernel} onChange={(e) => setKernel(e.target.value)}>
              <option value="add">Vector Addition: C = A + B</option>
              <option value="stencil">1D Stencil: B[i] = A[i-1] + A[i+1]</option>
            </select>
          </div>

          <div>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block', marginBottom: '4px' }}>
              DATA ELEMENTS (n):
            </label>
            <input
              type="number"
              value={n}
              min="8"
              max="512"
              step="8"
              onChange={(e) => setN(parseInt(e.target.value) || 64)}
            />
          </div>

          <div>
            <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block', marginBottom: '4px' }}>
              ARRAY PROCESSOR PEs:
            </label>
            <select value={peCount} onChange={(e) => setPeCount(parseInt(e.target.value) || 8)}>
              <option value="4">4 Processing Elements</option>
              <option value="8">8 Processing Elements (Default)</option>
              <option value="16">16 Processing Elements</option>
            </select>
          </div>
        </div>

        {/* 3-Way Metrics Bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginTop: '12px' }}>
          <div style={{ background: 'rgba(14, 15, 18, 0.85)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '8px', padding: '12px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-dim)' }}>SCALAR PROCESSOR</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.4rem', fontWeight: 700, color: '#fff', marginTop: '2px' }}>
              {scalarCycles} <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>cycles</span>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              1.00x BASELINE (5c/elem)
            </div>
          </div>

          <div style={{ background: 'rgba(14, 15, 18, 0.85)', border: '1px solid rgba(255, 255, 255, 0.22)', borderRadius: '8px', padding: '12px', boxShadow: '0 0 12px rgba(255, 255, 255, 0.05)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: '#ffffff' }}>VECTOR PROCESSOR (MVL=64)</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.4rem', fontWeight: 700, color: '#ffffff', marginTop: '2px' }}>
              {vectorCycles} <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>cycles</span>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: '#d1d5db', marginTop: '2px' }}>
              {(scalarCycles / vectorCycles).toFixed(2)}x ACCELERATION
            </div>
          </div>

          <div style={{ background: 'rgba(6, 24, 14, 0.85)', border: '1px solid var(--neon-emerald)', borderRadius: '8px', padding: '12px', boxShadow: '0 0 14px rgba(0, 255, 136, 0.3)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--neon-emerald)' }}>ARRAY PROCESSOR ({peCount} PEs)</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.4rem', fontWeight: 700, color: 'var(--neon-emerald)', marginTop: '2px', textShadow: '0 0 10px rgba(0, 255, 136, 0.5)' }}>
              {currentCycles} / {targetArrayCycles} <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>cycles</span>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--neon-emerald)', marginTop: '2px' }}>
              {(scalarCycles / targetArrayCycles).toFixed(2)}x ACCELERATION
            </div>
          </div>
        </div>

        {/* Race Toggle Bar */}
        <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            className="cyber-btn"
            style={{ fontSize: '0.75rem', padding: '6px 14px' }}
            onClick={() => {
              setShowRace(prev => !prev);
              playCyberBeep(650, 'sine', 0.04);
            }}
          >
            <span>🏎️</span> {showRace ? 'HIDE BENCHMARK ARENA' : 'OPEN 3-WAY HARDWARE RACE ARENA'}
          </button>

          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-dim)' }}>
            KEYBOARD SHORTCUTS: [SPACE] PLAY/PAUSE | [→] STEP | [R] RESET
          </span>
        </div>

        {/* Hardware Race Arena */}
        {showRace && (
          <div style={{
            marginTop: '16px',
            background: 'rgba(6, 8, 10, 0.95)',
            border: '1px solid var(--neon-emerald)',
            borderRadius: '8px',
            padding: '16px',
            animation: 'fadeIn 0.3s ease'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h4 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--neon-emerald)', letterSpacing: '1px' }}>
                  🏁 ARCHITECTURAL BENCHMARK DRAG RACE (n={n})
                </h4>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                  Simultaneous real-time execution across Scalar, Vector Pipelined, and SIMD Array architectures.
                </div>
              </div>
              <button
                className="cyber-btn"
                onClick={startRace}
                disabled={raceActive}
                style={{ fontSize: '0.75rem', padding: '6px 14px' }}
              >
                <span>{raceActive ? '⏳' : '⚡'}</span> {raceActive ? 'RACING...' : 'START HARDWARE RACE'}
              </button>
            </div>

            {/* Track 1: Scalar */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', marginBottom: '4px' }}>
                <span>🐢 SCALAR CORE (5 cyc/elem)</span>
                <span style={{ color: 'var(--text-dim)' }}>{Math.round(raceProgress.scalar)}% // {scalarCycles}c</span>
              </div>
              <div className="telemetry-progress-bg" style={{ height: '10px' }}>
                <div className="telemetry-progress-fill" style={{ width: `${raceProgress.scalar}%`, background: '#9ca3af' }} />
              </div>
            </div>

            {/* Track 2: Vector */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', marginBottom: '4px' }}>
                <span>⚡ VECTOR PIPELINE (12c startup + 1c/elem)</span>
                <span style={{ color: '#ffffff' }}>{Math.round(raceProgress.vector)}% // {vectorCycles}c</span>
              </div>
              <div className="telemetry-progress-bg" style={{ height: '10px' }}>
                <div className="telemetry-progress-fill" style={{ width: `${raceProgress.vector}%`, background: '#ffffff' }} />
              </div>
            </div>

            {/* Track 3: Array */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', marginBottom: '4px' }}>
                <span>🛰️ ARRAY PROCESSOR ({peCount} PEs // {isStencil ? '+6c mesh stall' : '0c stall'})</span>
                <span style={{ color: 'var(--neon-emerald)' }}>{Math.round(raceProgress.array)}% // {targetArrayCycles}c</span>
              </div>
              <div className="telemetry-progress-bg" style={{ height: '10px' }}>
                <div className="telemetry-progress-fill" style={{ width: `${raceProgress.array}%`, background: 'var(--neon-emerald)' }} />
              </div>
            </div>

            {raceProgress.finished && (
              <div style={{
                marginTop: '10px',
                padding: '8px 12px',
                background: 'rgba(0, 255, 136, 0.1)',
                border: '1px solid var(--neon-emerald)',
                borderRadius: '6px',
                display: 'flex',
                justifyContent: 'space-between',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem'
              }}>
                <span style={{ color: 'var(--neon-emerald)', fontWeight: 700 }}>
                  🏆 WINNER: {vectorCycles < targetArrayCycles ? 'VECTOR PIPELINED PROCESSOR' : 'PARALLEL ARRAY PROCESSOR'}
                </span>
                <span style={{ color: '#ffffff' }}>
                  PEAK SPEEDUP: {(scalarCycles / Math.min(vectorCycles, targetArrayCycles)).toFixed(2)}x over Scalar
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Simulation View */}
      <div className="layout-2col">
        {/* Left: PE Grid & Canvas */}
        <div className="cyber-card">
          <div className="card-header-hud">
            <h3><span>🛰️</span> ARRAY PE TOPOLOGY &amp; PACKET FLOW</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {peCount === 16 && (
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    className={`icon-btn ${topology === '1d' ? 'active' : ''}`}
                    onClick={() => {
                      setTopology('1d');
                      playCyberBeep(650, 'sine', 0.03);
                    }}
                    style={{ fontSize: '0.65rem', padding: '3px 8px' }}
                  >
                    1D BUS
                  </button>
                  <button
                    className={`icon-btn ${topology === '2d_mesh' ? 'active' : ''}`}
                    onClick={() => {
                      setTopology('2d_mesh');
                      playCyberBeep(750, 'sine', 0.03);
                    }}
                    style={{ fontSize: '0.65rem', padding: '3px 8px' }}
                  >
                    4×4 TORUS MESH
                  </button>
                </div>
              )}
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.72rem',
                color: isPlaying ? (isStencil ? 'var(--neon-amber)' : 'var(--neon-emerald)') : 'var(--neon-emerald)'
              }}>
                {isPlaying 
                  ? (isStencil ? (topology === '2d_mesh' ? '2D MESH: 4-WAY ROUTING' : 'MESH: INTER-PE ROUTING (+6c)') : 'MESH: BROADCASTING LOCKSTEP')
                  : (stepIndex >= totalSteps - 1 ? 'ALL STEPS COMMITTED' : 'MESH: IDLE')}
              </span>
            </div>
          </div>

          <div className="card-subtext">
            {isStencil 
              ? (topology === '2d_mesh' 
                  ? `2D TORUS MESH ACTIVE: Array Processor executes ${totalSteps} lockstep steps with multi-directional North/South/East/West routing.`
                  : `STENCIL ACTIVE: Array Processor executes ${totalSteps} lockstep steps. Each step incurs a 6-cycle inter-PE neighbor communication penalty!`)
              : `VECTOR ADD ACTIVE: Array Processor executes ${totalSteps} lockstep steps with zero neighbor communication.`}
          </div>

          <canvas ref={canvasRef} id="simCanvas" />

          {/* Time-Travel Cycle Scrubber */}
          <div style={{ marginTop: '12px', background: 'rgba(10, 12, 14, 0.85)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border-neon)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '4px' }}>
              <span>🎛️ TIME-TRAVEL CYCLE SCRUBBER:</span>
              <span style={{ color: 'var(--neon-emerald)', fontWeight: 700 }}>CYCLE {currentCycles} / {targetArrayCycles}</span>
            </div>
            <input
              type="range"
              min="0"
              max={targetArrayCycles}
              value={currentCycles}
              onChange={(e) => handleScrubCycles(Number(e.target.value))}
              style={{ width: '100%', marginBottom: 0 }}
            />
          </div>

          {/* Playback Controls */}
          <div className="playback-bar">
            <div className="playback-controls">
              <button className={`icon-btn ${isPlaying ? 'active' : ''}`} onClick={togglePlay}>
                {isPlaying ? '⏸ PAUSE' : (stepIndex >= totalSteps - 1 ? '▶ REPLAY' : '▶ PLAY')}
              </button>
              <button className="icon-btn" onClick={handleStep}>
                ⏭ STEP
              </button>
              <button className="icon-btn" onClick={handleReset}>
                ↺ RESET
              </button>
            </div>

            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>SPEED:</span>
              <select
                value={simSpeed}
                onChange={(e) => setSimSpeed(Number(e.target.value))}
                style={{ width: '80px', marginBottom: 0, padding: '4px' }}
              >
                <option value={1}>1.0x</option>
                <option value={2}>2.0x</option>
                <option value={4}>4.0x</option>
              </select>
            </div>
          </div>
        </div>

        {/* Right: Vector Register Strip-Mining & Register File */}
        <div className="cyber-card">
          <div className="card-header-hud">
            <h3><span>📦</span> VECTOR REGISTERS &amp; STRIP-MINING</h3>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--neon-cyan)' }}>
              MVL = 64 SLOTS
            </span>
          </div>

          <div className="card-subtext">
            Breaking array into chunks of 64 elements to fit hardware vector register file:
          </div>

          <div className="strip-chunk-grid">
            {chunks.map(chunk => (
              <div
                key={chunk.idx}
                className={`strip-chunk-box ${chunk.isActive ? 'highlight active-running' : ''}`}
              >
                <div style={{ color: 'var(--neon-cyan)', fontWeight: 700 }}>
                  CHUNK 0{chunk.idx}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                  [{chunk.start}:{chunk.end}] ({chunk.len} slots)
                </div>
                <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>
                  ⏱ {chunk.cycles} cycles
                </div>
              </div>
            ))}
          </div>

          {/* Live Vector Register File Dump */}
          <div style={{ marginTop: '14px', background: 'rgba(8, 9, 11, 0.95)', border: '1px solid var(--border-neon)', borderRadius: '6px', padding: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', marginBottom: '8px' }}>
              <span style={{ color: 'var(--neon-emerald)' }}>💽 LIVE VECTOR REGISTER FILE (32-BIT LANES):</span>
              <span style={{ color: 'var(--text-dim)' }}>COMMITTED STEP {stepIndex + 1}/{totalSteps}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '4px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.65rem' }}>
              {Array.from({ length: 8 }, (_, idx) => {
                const elem = stepIndex * peCount + idx;
                const active = elem < n;
                return (
                  <div key={idx} style={{ background: active ? 'rgba(0, 255, 136, 0.12)' : 'rgba(255, 255, 255, 0.04)', border: `1px solid ${active ? 'var(--neon-emerald)' : 'rgba(255, 255, 255, 0.1)'}`, borderRadius: '4px', padding: '4px 2px' }}>
                    <div style={{ color: '#fff', fontWeight: 700 }}>V0[{idx}]</div>
                    <div style={{ color: active ? 'var(--neon-emerald)' : 'var(--text-dim)', marginTop: '2px' }}>
                      {active ? `${elem + 1}` : '0'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ marginTop: '14px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '4px' }}>
              PIPELINE REGISTER ALLOCATION &amp; STRIP LOG:
            </div>
            <pre style={{
              background: 'rgba(8, 8, 8, 0.95)',
              border: '1px solid var(--border-neon)',
              borderRadius: '6px',
              padding: '10px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              color: 'var(--neon-emerald)',
              maxHeight: '110px',
              overflowY: 'auto'
            }}>
              {chunks.map(c => 
                `[Chunk ${c.idx}] Reg V0=A[${c.start}:${c.start+4}], V1=B[${c.start}:${c.start+4}] -> V2=C[${c.start}:${c.start+4}] (${c.cycles} cyc)`
              ).join('\n')}
            </pre>
          </div>

          <div style={{ marginTop: '12px', background: 'rgba(14, 15, 18, 0.88)', border: '1px solid var(--border-neon)', borderRadius: '6px', padding: '10px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--neon-amber)', fontWeight: 700 }}>
              ARCHITECTURAL HARDWARE HIGHLIGHT:
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.5 }}>
              {isStencil 
                ? "CRITICAL DIFFERENTIATOR: While Array Processors spike in latency due to PE-to-PE packet routing across the mesh bus, Vector Processors handle stencils via internal pipelined register shifts without bus stalls."
                : "For embarrassingly parallel loops, Array Processors scale linearly with PE count, while Vector Processors amortize startup latency over long vector chunks."}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}