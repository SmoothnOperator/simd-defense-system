import React, { useState } from 'react';
import { playCyberBeep } from '../utils/sound';

const WORKLOADS = {
  image_filter: {
    id: "image_filter",
    title: "2D Image Convolution / 3x3 Filter",
    kernelTarget: "stencil",
    arch: "Array Processor (2D SIMD Mesh)",
    scores: { scalar: 20, vector: 95, array: 99 },
    whyWin: "2D spatial pixel grid directly maps onto discrete physical PE mesh. Nearest-neighbor pixel transfers reuse values across local interconnections without saturating central memory bus.",
    whyStruggle: "Vector processors must perform repetitive unaligned register shifts. Scalar processors execute 1 pixel at a time, completely bottlenecked by loop indexing instructions.",
    silicon: "Google TPU v4/v5, NVIDIA Tensor Cores, Image Processing SIMD Units",
    params: "REGULARITY: HIGH // DEPENDENCY: 2D STENCIL // COMM: NEIGHBOR LOCAL // STRIDE: CONTIGUOUS"
  },
  matrix_multiply: {
    id: "matrix_multiply",
    title: "GEMM Dense Matrix Multiplication (C = A * B)",
    kernelTarget: "add",
    arch: "Array Processor (Systolic Mesh)",
    scores: { scalar: 20, vector: 95, array: 99 },
    whyWin: "Values flow rhythmically through rows and columns in systolic lockstep. Data is reused dozens of times without round-trips to DRAM, achieving maximum arithmetic density.",
    whyStruggle: "Scalar CPUs bottleneck on memory bandwidth and serial FMA stalls. Vector processors perform well with FMA chaining, but cannot match systolic data reuse.",
    silicon: "Google Cloud TPU (Systolic Matrix Engine), Apple Neural Engine",
    params: "REGULARITY: VERY HIGH // DEPENDENCY: REDUCTION TREE // COMM: SYSTOLIC FORWARDING"
  },
  grid_physics: {
    id: "grid_physics",
    title: "CFD & Lattice Boltzmann Grid Physics",
    kernelTarget: "stencil",
    arch: "Array Processor (SIMD Lattice)",
    scores: { scalar: 20, vector: 95, array: 99 },
    whyWin: "Differential equation finite-difference grids map onto PEs with synchronous halo boundary exchanges. High lockstep synchronization perfectly fits physical time-step updates.",
    whyStruggle: "Vector processors require expensive multi-dimensional gather/scatter instructions across grid planes. Scalar CPUs are vastly too slow for multi-million cell grids.",
    silicon: "Custom PDE Supercomputers, GPU Mesh Compute Arrays",
    params: "REGULARITY: HIGH // DEPENDENCY: HALO STENCIL // COMM: SYNCHRONOUS HALO MESH"
  },
  database_query: {
    id: "database_query",
    title: "Columnar Database Filter / Scan",
    kernelTarget: "add",
    arch: "Vector Processor (Streaming SIMD)",
    scores: { scalar: 20, vector: 95, array: 65 },
    whyWin: "Unit-stride contiguous column scans with zero inter-lane communication. Pipelined vector registers stream through gigabytes of table columns at memory bus wire-speed.",
    whyStruggle: "Array processors introduce unnecessary inter-PE synchronization overhead. Scalar processors stall on memory latency and branch predictor penalties.",
    silicon: "Intel AVX-512, ARM SVE2, RISC-V Vector Extensions",
    params: "REGULARITY: MEDIUM // DEPENDENCY: ZERO (INDEPENDENT) // COMM: NONE // STRIDE: UNIT-STRIDE"
  },
  linked_list: {
    id: "linked_list",
    title: "Linked List Traversal / Pointer Chasing",
    kernelTarget: "add",
    arch: "Scalar Processor (Superscalar OOO)",
    scores: { scalar: 99, vector: 5, array: 5 },
    whyWin: "Strict loop-carried pointer chasing (`node = node->next`). High-frequency superscalar CPU with deep L1/L2 caches, out-of-order execution, and hardware prefetchers dominates.",
    whyStruggle: "Vector and Array processors suffer total failure: SIMD lanes cannot execute concurrently when address(i+1) depends on data(i). 0% vector lane utilization.",
    silicon: "Intel Core i9-14900K, AMD Ryzen Zen 4 / Zen 5",
    params: "REGULARITY: LOW // DEPENDENCY: POINTER CHASING // COMM: RANDOM DRAM // STRIDE: NON-CONTIGUOUS"
  }
};

export default function RecommenderTab({ onDeployWorkload }) {
  const [selectedKey, setSelectedKey] = useState("image_filter");
  const current = WORKLOADS[selectedKey] || WORKLOADS.image_filter;

  const handleSelectWorkload = (key) => {
    setSelectedKey(key);
    playCyberBeep(680, 'sine', 0.05);
  };

  const handleDeploy = () => {
    playCyberBeep(920, 'triangle', 0.12);
    if (onDeployWorkload) {
      onDeployWorkload(current.kernelTarget);
    }
  };

  return (
    <section>
      <div className="layout-2col">
        {/* Left: Input Selection & Param HUD */}
        <div className="cyber-card">
          <div className="card-header-hud">
            <h3><span>💼</span> WORKLOAD PROFILE SELECTOR</h3>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--neon-cyan)' }}>
              DOMAIN SPEC
            </span>
          </div>

          <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block', marginBottom: '6px' }}>
            SELECT COMPUTATIONAL WORKLOAD:
          </label>
          <select value={selectedKey} onChange={(e) => handleSelectWorkload(e.target.value)}>
            {Object.entries(WORKLOADS).map(([k, w]) => (
              <option key={k} value={k}>{w.title}</option>
            ))}
          </select>

          <div style={{
            background: 'rgba(18, 4, 8, 0.88)',
            border: '1px solid var(--border-neon)',
            borderRadius: '8px',
            padding: '16px',
            marginTop: '16px'
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '4px' }}>
              EXTRACTED COMPUTATION PARAMETERS:
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--neon-emerald)', lineHeight: 1.6 }}>
              {current.params}
            </div>
          </div>

          <div style={{ marginTop: '20px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '8px' }}>
              RULE-BASED EVALUATOR TAXONOMY:
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              The recommender inspects 4 fundamental microarchitectural dimensions:
              <strong> spatial regularity</strong>, <strong>inter-element dependencies</strong>,
              <strong> data reuse density</strong>, and <strong>communication routing topology</strong>.
            </p>
          </div>
        </div>

        {/* Right: Recommendation & Suitability Meters */}
        <div className="cyber-card">
          <div className="card-header-hud">
            <h3><span>🏆</span> ARCHITECTURAL PROPOSAL VERDICT</h3>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--neon-emerald)' }}>
              OPTIMAL SILICON
            </span>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <div className="status-badge badge-secure" style={{ fontSize: '0.95rem' }}>
              <span>★</span> RECOMMENDED SILICON: {current.arch.toUpperCase()}
            </div>
          </div>

          {/* Telemetry Progress Bars */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
              <span>SCALAR PROCESSOR SUITABILITY:</span>
              <span style={{ color: current.scores.scalar > 50 ? 'var(--neon-emerald)' : 'var(--neon-amber)', fontWeight: 700 }}>
                {current.scores.scalar}/100
              </span>
            </div>
            <div className="telemetry-progress-bg">
              <div
                className="telemetry-progress-fill"
                style={{ width: `${current.scores.scalar}%`, background: current.scores.scalar > 50 ? 'var(--neon-emerald)' : 'var(--neon-amber)' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
              <span>VECTOR PROCESSOR SUITABILITY:</span>
              <span style={{ color: 'var(--neon-cyan)', fontWeight: 700 }}>
                {current.scores.vector}/100
              </span>
            </div>
            <div className="telemetry-progress-bg">
              <div
                className="telemetry-progress-fill"
                style={{ width: `${current.scores.vector}%`, background: 'var(--neon-cyan)' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
              <span>ARRAY PROCESSOR SUITABILITY:</span>
              <span style={{ color: 'var(--neon-emerald)', fontWeight: 700 }}>
                {current.scores.array}/100
              </span>
            </div>
            <div className="telemetry-progress-bg">
              <div
                className="telemetry-progress-fill"
                style={{ width: `${current.scores.array}%`, background: 'var(--neon-emerald)' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <h4 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--neon-cyan)', letterSpacing: '1px' }}>
              WHY THE PROPOSED ENGINE WINS:
            </h4>
            <p style={{ color: 'var(--text-primary)', fontSize: '0.85rem', marginTop: '4px', lineHeight: 1.5 }}>
              {current.whyWin}
            </p>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <h4 style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--neon-amber)', letterSpacing: '1px' }}>
              WHY ALTERNATIVES STRUGGLE:
            </h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px', lineHeight: 1.5 }}>
              {current.whyStruggle}
            </p>
          </div>

          <div style={{ background: 'rgba(18, 4, 8, 0.88)', border: '1px solid var(--border-neon)', borderRadius: '8px', padding: '10px', marginBottom: '14px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-dim)' }}>REAL-WORLD SILICON TARGET:</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--neon-emerald)', marginTop: '2px' }}>
              {current.silicon}
            </div>
          </div>

          <button
            className="cyber-btn"
            onClick={handleDeploy}
            style={{ width: '100%', justifyContent: 'center', fontSize: '0.82rem', padding: '10px 16px' }}
          >
            <span>🚀</span> DEPLOY WORKLOAD TO SIMULATOR &amp; EXECUTE
          </button>
        </div>
      </div>
    </section>
  );
}
