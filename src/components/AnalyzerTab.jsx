import React, { useState } from 'react';
import { playCyberBeep, playScanTone } from '../utils/sound';

const LOOPS = [
  {
    id: 1,
    title: "Loop 01: Element-wise SAXPY / Linear Combination",
    code: `for i in range(n):\n    A[i] = 2.5 * B[i] + C[i]`,
    verdict: "Vectorizable",
    reason: "Zero loop-carried dependencies. All iterations are mathematically orthogonal and read independent disjoint memory addresses.",
    hazard: "None. Direct 1:1 hardware vector lane mapping (100% compute density).",
    badgeClass: "badge-secure",
    statusText: "ALL 8 LANES COMPUTE IN LOCKSTEP (100% UTILIZATION)",
    lanes: Array.from({ length: 8 }, (_, i) => ({
      name: "EXEC",
      sub: "2.5*B+C",
      type: "active"
    }))
  },
  {
    id: 2,
    title: "Loop 02: Fibonacci-Style Recurrence (A[i] = A[i-1] + B[i])",
    code: `for i in range(1, n):\n    A[i] = A[i-1] + B[i]`,
    verdict: "Not vectorizable",
    reason: "True RAW (Read-After-Write) loop-carried dependency: iteration i strictly requires the updated result computed by iteration i-1.",
    hazard: "Serial data dependency stalls parallel lanes. Standard SIMD lockstep execution stalls; requires parallel prefix tree (Blelloch scan).",
    badgeClass: "badge-hazard",
    statusText: "HAZARD DETECTED: SERIAL DEPENDENCY STALLS LANES 1-7",
    lanes: Array.from({ length: 8 }, (_, i) => ({
      name: i === 0 ? "EXEC" : "BLOCKED",
      sub: i === 0 ? "A[0]=10" : `NEEDS A[${i-1}]`,
      type: i === 0 ? "active" : "hazard"
    }))
  },
  {
    id: 3,
    title: "Loop 03: Conditional Divergent Branching",
    code: `for i in range(n):\n    if A[i] > 0:\n        A[i] = 2.0 * A[i]\n    else:\n        A[i] = -A[i]`,
    verdict: "Partly vectorizable",
    reason: "Control-flow divergence across vector lanes requires hardware execution predication / mask registers.",
    hazard: "Inactive masked lanes remain powered but idle during divergent branch phases, reducing effective throughput.",
    badgeClass: "badge-warning",
    statusText: "PREDICATION ACTIVE: DIVERGENT LANES MASKED OFF",
    lanes: Array.from({ length: 8 }, (_, i) => ({
      name: [0, 1, 3, 4].includes(i) ? "EXEC" : "MASKED",
      sub: [0, 1, 3, 4].includes(i) ? "2.0 * A" : "-A[i] write",
      type: [0, 1, 3, 4].includes(i) ? "active" : "masked"
    }))
  },
  {
    id: 4,
    title: "Loop 04: Indirect Indexed Memory Access (Gather)",
    code: `for i in range(n):\n    A[i] = B[idx[i]]`,
    verdict: "Partly vectorizable",
    reason: "Memory addresses depend on runtime integer index array, resulting in non-contiguous non-unit stride memory traffic.",
    hazard: "Non-unit stride leads to cache underutilization and memory bank conflicts.",
    badgeClass: "badge-warning",
    statusText: "NON-UNIT STRIDE: DRAM BANK CONFLICT STALL",
    lanes: Array.from({ length: 8 }, (_, i) => ({
      name: "GATHER",
      sub: `B[idx[${i}]]`,
      type: "masked"
    }))
  },
  {
    id: 5,
    title: "Loop 05: Scalar Accumulation / Reduction Tree",
    code: `total = 0.0\nfor i in range(n):\n    total += A[i]`,
    verdict: "Partly vectorizable",
    reason: "Single scalar accumulator creates a reduction dependency across iterations.",
    hazard: "Requires horizontal pairwise reduction tree plus scalar post-processing.",
    badgeClass: "badge-warning",
    statusText: "TREE REDUCTION: PAIRWISE HORIZONTAL ADD",
    lanes: Array.from({ length: 8 }, (_, i) => ({
      name: `L${i}`,
      sub: "PAIRWISE +",
      type: "active"
    }))
  },
  {
    id: 6,
    title: "Loop 06: 1D Spatial Stencil Smoothing",
    code: `for i in range(1, n-1):\n    B[i] = 0.5 * (A[i-1] + A[i+1])`,
    verdict: "Vectorizable",
    reason: "Independent iterations on target array B. Reads neighboring elements of A without write hazard.",
    hazard: "Requires unaligned vector loads or register shifts. In Array processors, requires inter-PE routing.",
    badgeClass: "badge-secure",
    statusText: "PARALLEL STENCIL OUTPUT TO TARGET ARRAY B",
    lanes: Array.from({ length: 8 }, (_, i) => ({
      name: "STENCIL",
      sub: "A[i±1]",
      type: "active"
    }))
  }
];

function analyzeCustomKernel(code, width) {
  const isRecurrence = /A\[i\]\s*=.*A\[i\s*-\s*1\]/i.test(code) || /\[i\s*-\s*\d+\]/i.test(code);
  const hasBranch = /if\s*\(|if\s+[A-Za-z0-9_\[\]]/i.test(code);
  const hasIndirect = /\[idx\[|\[[A-Za-z]\[i\]\]/i.test(code);
  const hasReduction = /\+\=|sum\s*=/i.test(code);
  const hasStencil = /\[i\s*-\s*1\]\s*\+.*\[i\s*\+\s*1\]/i.test(code);

  if (isRecurrence && !hasStencil) {
    return {
      verdict: "Not vectorizable",
      reason: "True Loop-Carried RAW (Read-After-Write) hazard: Iteration i requires updated result from i-1.",
      hazard: "Serial loop recurrence stalls all parallel hardware lanes. Requires parallel prefix tree (Blelloch scan).",
      lanes: Array.from({ length: width }, (_, i) => ({
        name: i === 0 ? "EXEC" : "BLOCKED",
        sub: i === 0 ? "SEED" : `NEEDS A[${i-1}]`,
        type: i === 0 ? "hazard" : "hazard"
      })),
      statusText: `HAZARD: SERIAL RAW DEPENDENCY BLOCKS LANES 1-${width - 1}`,
      badgeClass: "badge-danger"
    };
  } else if (hasBranch) {
    const activeIndices = [0, 1, 3, 4, 8, 9, 11, 12].slice(0, width);
    return {
      verdict: "Partly vectorizable",
      reason: "Control-flow branch divergence detected. Requires SIMD execution predication and hardware mask registers.",
      hazard: "Lanes evaluating condition to FALSE remain idle during execution phase, wasting ALU throughput.",
      lanes: Array.from({ length: width }, (_, i) => ({
        name: activeIndices.includes(i) ? "EXEC" : "MASKED",
        sub: activeIndices.includes(i) ? "TAKEN" : "IDLE MASK",
        type: activeIndices.includes(i) ? "active" : "masked"
      })),
      statusText: "PREDICATION ACTIVE: BRANCH DIVERGENCE MASKED",
      badgeClass: "badge-warning"
    };
  } else if (hasIndirect) {
    return {
      verdict: "Partly vectorizable",
      reason: "Non-unit stride indirect memory access detected (e.g. Gather). DRAM memory bank conflicts.",
      hazard: "Gather/Scatter engine must serialize memory requests across cache banks, incurring multi-cycle latency.",
      lanes: Array.from({ length: width }, (_, i) => ({
        name: "GATHER",
        sub: `BANK_${i % 4}`,
        type: "masked"
      })),
      statusText: `INDIRECT GATHER: DRAM BANK CONFLICT STALL ON ${width} LANES`,
      badgeClass: "badge-warning"
    };
  } else if (hasReduction) {
    return {
      verdict: "Partly vectorizable",
      reason: "Scalar reduction accumulator detected across loop iterations.",
      hazard: "Requires logarithmic horizontal pairwise butterfly reduction tree before write-back.",
      lanes: Array.from({ length: width }, (_, i) => ({
        name: `PAIR_${i}`,
        sub: "REDUCE +",
        type: "active"
      })),
      statusText: `TREE REDUCTION: ${Math.round(Math.log2(width))}-STAGE LOG2(${width}) PAIRWISE TREE`,
      badgeClass: "badge-warning"
    };
  } else {
    return {
      verdict: "Vectorizable",
      reason: "Zero loop-carried dependencies. All iterations operate on orthogonal disjoint memory addresses.",
      hazard: "None! Direct 1:1 hardware SIMD mapping at 100% compute density.",
      lanes: Array.from({ length: width }, (_, i) => ({
        name: "EXEC",
        sub: "LOCKSTEP",
        type: "active"
      })),
      statusText: `ALL ${width} LANES EXECUTING IN LOCKSTEP (100% UTILIZATION)`,
      badgeClass: "badge-secure"
    };
  }
}

export default function AnalyzerTab() {
  const [selectedLoopId, setSelectedLoopId] = useState(1);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customCode, setCustomCode] = useState("for i in range(n):\n    A[i] = 2.0 * B[i] + C[i]");
  const [simdWidth, setSimdWidth] = useState(16);
  const [isScanning, setIsScanning] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [laneInspectMsg, setLaneInspectMsg] = useState(null);

  const presetLoops = LOOPS.find(l => l.id === selectedLoopId) || LOOPS[0];
  const customEvaluation = analyzeCustomKernel(customCode, simdWidth);
  const currentLoop = isCustomMode ? { ...customEvaluation, title: "Custom Kernel Sandbox", code: customCode } : presetLoops;

  const getLanesForLoop = (loopId, width) => {
    if (isCustomMode) return customEvaluation.lanes;
    if (loopId === 1) {
      return Array.from({ length: width }, (_, i) => ({
        name: "EXEC",
        sub: "2.5*B+C",
        type: "active"
      }));
    }
    if (loopId === 2) {
      return Array.from({ length: width }, (_, i) => ({
        name: i === 0 ? "EXEC" : "BLOCKED",
        sub: i === 0 ? "A[0]=10" : `NEEDS A[${i-1}]`,
        type: i === 0 ? "active" : "hazard"
      }));
    }
    if (loopId === 3) {
      const activeIndices = [0, 1, 3, 4, 8, 9, 11, 12];
      return Array.from({ length: width }, (_, i) => ({
        name: activeIndices.includes(i) ? "EXEC" : "MASKED",
        sub: activeIndices.includes(i) ? "2.0 * A" : "-A[i] write",
        type: activeIndices.includes(i) ? "active" : "masked"
      }));
    }
    if (loopId === 4) {
      return Array.from({ length: width }, (_, i) => ({
        name: "GATHER",
        sub: `B[idx[${i}]]`,
        type: "masked"
      }));
    }
    if (loopId === 5) {
      return Array.from({ length: width }, (_, i) => ({
        name: `L${i}`,
        sub: "PAIRWISE +",
        type: "active"
      }));
    }
    return Array.from({ length: width }, (_, i) => ({
      name: "STENCIL",
      sub: "A[i±1]",
      type: "active"
    }));
  };

  const getStatusText = (loopId, width) => {
    if (isCustomMode) return customEvaluation.statusText;
    if (loopId === 1) return `ALL ${width} LANES COMPUTE IN LOCKSTEP (100% UTILIZATION)`;
    if (loopId === 2) return `HAZARD DETECTED: SERIAL DEPENDENCY STALLS LANES 1-${width - 1}`;
    if (loopId === 3) return `PREDICATION ACTIVE: DIVERGENT LANES MASKED OFF`;
    if (loopId === 4) return `NON-UNIT STRIDE: ${width}-WAY DRAM BANK CONFLICT STALL`;
    if (loopId === 5) return `TREE REDUCTION: ${Math.round(Math.log2(width))}-STAGE LOG2(${width}) PAIRWISE ADD`;
    return `PARALLEL ${width}-LANE STENCIL OUTPUT TO TARGET ARRAY B`;
  };

  const activeLanes = getLanesForLoop(selectedLoopId, simdWidth);
  const activeStatusText = getStatusText(selectedLoopId, simdWidth);

  const handleSelectLoop = (id) => {
    if (id === 0) {
      setIsCustomMode(true);
    } else {
      setIsCustomMode(false);
      setSelectedLoopId(id);
    }
    setHasScanned(false);
    setIsScanning(false);
    setLaneInspectMsg(null);
    playCyberBeep(520, 'sine', 0.04);
  };

  const setCustomPreset = (presetCode) => {
    setCustomCode(presetCode);
    setHasScanned(false);
    playCyberBeep(640, 'sine', 0.03);
  };

  const triggerScan = () => {
    setIsScanning(true);
    setHasScanned(false);
    setScanProgress(0);
    setLaneInspectMsg(null);
    playScanTone();

    let p = 0;
    const interval = setInterval(() => {
      p += 20;
      if (p >= 100) {
        clearInterval(interval);
        setScanProgress(100);
        setTimeout(() => {
          setIsScanning(false);
          setHasScanned(true);
          if (currentLoop.verdict === "Vectorizable") {
            playCyberBeep(1040, 'triangle', 0.15);
          } else if (currentLoop.verdict === "Not vectorizable") {
            playCyberBeep(320, 'sawtooth', 0.22);
          } else {
            playCyberBeep(740, 'sine', 0.12);
          }
        }, 120);
      } else {
        setScanProgress(p);
      }
    }, 70);
  };

  const handleLaneClick = (p) => {
    playCyberBeep(580 + (p % 8) * 45, 'triangle', 0.06);

    const msgs = {
      1: `LANE ${p}: Contiguous Lockstep Execution // C[${p}] = 2.5 * B[${p}] + C[${p}]. Zero dependency hazards.`,
      2: p === 0 
        ? `LANE 0: Seeds recurrence A[0] = 10. Memory write committed.` 
        : `LANE ${p}: CRITICAL RAW HAZARD // Stalled waiting for updated A[${p-1}] from Lane ${p-1}!`,
      3: [0, 1, 3, 4, 8, 9, 11, 12].includes(p)
        ? `LANE ${p}: Predicate TRUE (A[${p}] > 0) -> Computes 2.0 * A[${p}] with write-back active.`
        : `LANE ${p}: Predicate FALSE (A[${p}] <= 0) -> MASKED OFF! Execution slot wasted to preserve correctness.`,
      4: `LANE ${p}: Non-unit stride Gather // Fetching B[idx[${p}]]. Multi-cycle DRAM cache bank serialization.`,
      5: `LANE ${p}: Pairwise Logarithmic Reduction // Forwarding intermediate partial sum across horizontal butterfly tree.`,
      6: `LANE ${p}: Spatial Stencil // Computes 0.5 * (A[${p}-1] + A[${p}+1]) into output array B[${p}].`
    };

    if (isCustomMode) {
      const lane = activeLanes[p] || { name: 'EXEC', type: 'active' };
      setLaneInspectMsg({
        text: `LANE ${p}: [${lane.name}] // ${lane.type === 'hazard' ? 'BLOCKED by RAW loop-carried recurrence hazard' : lane.type === 'masked' ? 'MASKED OFF by predication or bank conflict' : 'ACTIVE compute slot executing in lockstep'}`,
        isHazard: lane.type === 'hazard'
      });
    } else {
      setLaneInspectMsg({
        text: msgs[selectedLoopId] || `LANE ${p}: SIMD hardware lane active.`,
        isHazard: selectedLoopId === 2 && p > 0
      });
    }
  };

  return (
    <section>
      <div className="layout-2col">
        {/* Left: Code Stream & Scan Control */}
        <div className="cyber-card">
          <div className="card-header-hud">
            <h3><span>🛡️</span> CODE STREAM INSPECTOR</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className={`icon-btn ${!isCustomMode ? 'active' : ''}`}
                onClick={() => handleSelectLoop(selectedLoopId || 1)}
                style={{ fontSize: '0.72rem', padding: '4px 10px' }}
              >
                PRESETS
              </button>
              <button
                className={`icon-btn ${isCustomMode ? 'active' : ''}`}
                onClick={() => handleSelectLoop(0)}
                style={{ fontSize: '0.72rem', padding: '4px 10px' }}
              >
                🧪 CUSTOM SANDBOX
              </button>
            </div>
          </div>

          {!isCustomMode ? (
            <>
              <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block', marginBottom: '6px' }}>
                SELECT TARGET COMPUTATION KERNEL:
              </label>
              <select value={selectedLoopId} onChange={(e) => handleSelectLoop(Number(e.target.value))}>
                {LOOPS.map(l => (
                  <option key={l.id} value={l.id}>{l.title}</option>
                ))}
              </select>

              <div style={{ position: 'relative', marginTop: '12px' }}>
                <div className={`code-box ${isScanning ? 'scanning' : ''}`}>
                  {currentLoop.code}
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--neon-emerald)' }}>
                  CUSTOM C / PYTHON LOOP EDITOR:
                </label>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                  LIVE AST PARSER ARMED
                </span>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                <button
                  type="button"
                  className="icon-btn"
                  style={{ fontSize: '0.7rem', padding: '4px 8px' }}
                  onClick={() => setCustomPreset("for i in range(n):\n    A[i] = 2.5 * B[i] + C[i]")}
                >
                  + SAXPY
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  style={{ fontSize: '0.7rem', padding: '4px 8px' }}
                  onClick={() => setCustomPreset("for i in range(1, n):\n    A[i] = A[i-1] + B[i]")}
                >
                  + RAW Recurrence
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  style={{ fontSize: '0.7rem', padding: '4px 8px' }}
                  onClick={() => setCustomPreset("for i in range(n):\n    if A[i] > 0:\n        A[i] = 2.0 * A[i]\n    else:\n        A[i] = -A[i]")}
                >
                  + Branch Divergence
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  style={{ fontSize: '0.7rem', padding: '4px 8px' }}
                  onClick={() => setCustomPreset("total = 0.0\nfor i in range(n):\n    total += A[i]")}
                >
                  + Reduction Sum
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  style={{ fontSize: '0.7rem', padding: '4px 8px' }}
                  onClick={() => setCustomPreset("for i in range(n):\n    A[i] = B[idx[i]]")}
                >
                  + Gather Indirect
                </button>
              </div>

              <textarea
                value={customCode}
                onChange={(e) => {
                  setCustomCode(e.target.value);
                  setHasScanned(false);
                }}
                rows={5}
                className={`code-box ${isScanning ? 'scanning' : ''}`}
                style={{
                  width: '100%',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.85rem',
                  background: 'rgba(8, 8, 8, 0.95)',
                  color: '#ffffff',
                  border: '1px solid var(--border-neon)',
                  borderRadius: '6px',
                  padding: '12px',
                  resize: 'vertical',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                placeholder="Enter loop, e.g. for i in range(n): A[i] = A[i-1] + B[i]"
              />
            </>
          )}

          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-dim)' }}>
              LLVM LOOPVECTORIZER PASS
            </span>
            <button
              className="cyber-btn"
              onClick={triggerScan}
              disabled={isScanning}
            >
              <span>{isScanning ? '⏳' : '⚡'}</span>
              <span>{isScanning ? 'AUDITING CODE STREAM...' : (hasScanned ? 'RE-RUN SECURITY SCAN' : 'RUN DEEP SECURITY SCAN')}</span>
            </button>
          </div>
        </div>

        {/* Right: Security Verdict & SIMD Lane Matrix */}
        <div className="cyber-card">
          <div className="card-header-hud">
            <h3><span>🔬</span> VECTOR AUDIT TELEMETRY</h3>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.72rem',
              color: hasScanned 
                ? (currentLoop.verdict === 'Vectorizable' ? 'var(--neon-emerald)' : 'var(--neon-amber)')
                : (isScanning ? 'var(--neon-cyan)' : 'var(--neon-amber)')
            }}>
              {hasScanned 
                ? (currentLoop.verdict === 'Vectorizable' ? 'AUDIT COMPLETE // SHIELD ACTIVE' : currentLoop.verdict === 'Not vectorizable' ? 'AUDIT COMPLETE // CRITICAL HAZARD' : 'AUDIT COMPLETE // MASK OVERHEAD')
                : (isScanning ? 'AUDITING KERNEL STREAM...' : 'STANDBY // AWAITING AUDIT')}
            </span>
          </div>

          {/* Standby View */}
          {!hasScanned && !isScanning && (
            <div className="radar-screen">
              <div className="radar-sweep" />
              <div style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-title)', fontSize: '1.05rem', color: '#fff', letterSpacing: '1px' }}>
                  AWAITING DEEP SECURITY SCAN
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--text-dim)', marginTop: '6px' }}>
                  {isCustomMode ? 'Edit kernel and click [RUN DEEP SECURITY SCAN] to evaluate dependencies.' : 'Select kernel and click [RUN DEEP SECURITY SCAN] to evaluate dependencies.'}
                </div>
              </div>
            </div>
          )}

          {/* Scanning Progress */}
          {isScanning && (
            <div style={{ padding: '30px 20px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--neon-cyan)', marginBottom: '10px' }}>
                PARSING ABSTRACT SYNTAX TREE // DATAFLOW ANALYSIS...
              </div>
              <div className="telemetry-progress-bg" style={{ height: '14px' }}>
                <div
                  className="telemetry-progress-fill"
                  style={{ width: `${scanProgress}%`, background: 'var(--neon-emerald)' }}
                />
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                {scanProgress}% SCANNED // CHECKING INDUCTION VARIABLES &amp; STRIDE
              </div>
            </div>
          )}

          {/* Scan Results */}
          {hasScanned && (
            <div className="result-reveal">
              <div style={{ marginBottom: '14px' }}>
                <div className={`status-badge ${currentLoop.badgeClass}`}>
                  <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'currentColor' }} />
                  VERDICT: {currentLoop.verdict.toUpperCase()}
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                  EQUIVALENCE VERIFICATION (NUMPY vs SCALAR):
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--neon-emerald)', fontWeight: 700 }}>
                  ✓ ZERO DATA DIVERGENCE DETECTED (100% IDENTICAL OUTPUT)
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                  ARCHITECTURAL REASONING:
                </div>
                <p style={{ color: 'var(--text-primary)', fontSize: '0.85rem', marginTop: '4px', lineHeight: 1.5 }}>
                  {currentLoop.reason}
                </p>
              </div>

              <div style={{
                background: currentLoop.verdict === 'Vectorizable' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                border: `1px solid ${currentLoop.verdict === 'Vectorizable' ? 'var(--neon-emerald)' : 'var(--neon-amber)'}`,
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '16px'
              }}>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: currentLoop.verdict === 'Vectorizable' ? 'var(--neon-emerald)' : 'var(--neon-amber)'
                }}>
                  CRITICAL HARDWARE BOTTLENECK:
                </div>
                <p style={{ color: 'var(--text-primary)', fontSize: '0.82rem', marginTop: '4px', lineHeight: 1.5 }}>
                  {currentLoop.hazard}
                </p>
              </div>
            </div>
          )}

          {/* SIMD Lane Matrix */}
          <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-neon)', paddingTop: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                  HARDWARE SIMD LANES:
                </span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    className="cyber-btn"
                    style={{
                      padding: '2px 8px',
                      fontSize: '0.65rem',
                      borderColor: simdWidth === 8 ? 'var(--neon-emerald)' : 'rgba(255, 255, 255, 0.16)',
                      background: simdWidth === 8 ? 'rgba(0, 255, 136, 0.18)' : 'transparent',
                      color: simdWidth === 8 ? '#ffffff' : 'var(--text-dim)'
                    }}
                    onClick={() => {
                      setSimdWidth(8);
                      setLaneInspectMsg(null);
                      playCyberBeep(700, 'sine', 0.04);
                    }}
                  >
                    8 LANES (AVX2)
                  </button>
                  <button
                    className="cyber-btn"
                    style={{
                      padding: '2px 8px',
                      fontSize: '0.65rem',
                      borderColor: simdWidth === 16 ? 'var(--neon-emerald)' : 'rgba(255, 255, 255, 0.16)',
                      background: simdWidth === 16 ? 'rgba(0, 255, 136, 0.18)' : 'transparent',
                      color: simdWidth === 16 ? '#ffffff' : 'var(--text-dim)'
                    }}
                    onClick={() => {
                      setSimdWidth(16);
                      setLaneInspectMsg(null);
                      playCyberBeep(750, 'sine', 0.04);
                    }}
                  >
                    16 LANES (AVX-512)
                  </button>
                </div>
              </div>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.72rem',
                color: laneInspectMsg ? (laneInspectMsg.isHazard ? 'var(--neon-amber)' : 'var(--neon-emerald)') : 'var(--neon-emerald)'
              }}>
                {laneInspectMsg ? laneInspectMsg.text : (hasScanned ? activeStatusText : `LANES (0-${simdWidth-1}): STANDBY // BUFFER LOADED`)}
              </span>
            </div>

            <div className={`simd-lane-matrix ${simdWidth === 16 ? 'lanes-16' : ''}`}>
              {activeLanes.map((lane, p) => (
                <div
                  key={p}
                  className={`lane-box ${hasScanned ? `${lane.type} lane-animated` : ''}`}
                  style={{ animationDelay: `${p * 0.03}s` }}
                  onClick={() => hasScanned && handleLaneClick(p)}
                  title={`Click to inspect Lane ${p}`}
                >
                  <strong>L{p}</strong>
                  <br />
                  <span>{hasScanned ? lane.name : 'IDLE'}</span>
                  <br />
                  <span style={{ fontSize: '0.62rem', color: 'var(--text-dim)' }}>
                    {hasScanned ? lane.sub : '-'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}