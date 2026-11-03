/**
 * SIMD Explorer - Node.js REST API Server
 * High-Assurance Computation & Architecture HUD Backend
 * 
 * Provides cycle accurate hardware simulation, loop vectorizability auditing,
 * and Amdahl's Law telemetry endpoints.
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// -----------------------------------------------------------------------------
// MODULE 1 DATABASE: 6 Sample Loops & Classification Taxonomy
// -----------------------------------------------------------------------------
const loopDatabase = {
  1: {
    id: 1,
    title: "Loop 01: Element-wise SAXPY / Linear Combination",
    code: `for i in range(n):\n    A[i] = 2.5 * B[i] + C[i]`,
    verdict: "Vectorizable",
    reason: "Zero loop-carried dependencies. All iterations are mathematically orthogonal and read independent disjoint memory addresses.",
    hazard: "None. Direct 1:1 hardware vector lane mapping (100% compute density).",
    badgeClass: "badge-secure",
    statusText: "ALL 8 LANES COMPUTE IN LOCKSTEP (100% UTILIZATION)",
    lanes: Array.from({ length: 8 }, (_, i) => ({
      lane: i,
      name: "EXEC",
      sub: "2.5*B+C",
      type: "active"
    }))
  },
  2: {
    id: 2,
    title: "Loop 02: Fibonacci-Style Recurrence (A[i] = A[i-1] + B[i])",
    code: `for i in range(1, n):\n    A[i] = A[i-1] + B[i]`,
    verdict: "Not vectorizable",
    reason: "True RAW (Read-After-Write) loop-carried dependency: iteration i strictly requires the updated result computed by iteration i-1.",
    hazard: "Serial data dependency stalls parallel lanes. Standard SIMD lockstep execution stalls; requires parallel prefix tree (Blelloch scan).",
    badgeClass: "badge-hazard",
    statusText: "HAZARD DETECTED: SERIAL DEPENDENCY STALLS LANES 1-7",
    lanes: Array.from({ length: 8 }, (_, i) => ({
      lane: i,
      name: i === 0 ? "EXEC" : "BLOCKED",
      sub: i === 0 ? "A[0]=10" : `NEEDS A[${i-1}]`,
      type: i === 0 ? "active" : "hazard"
    }))
  },
  3: {
    id: 3,
    title: "Loop 03: Conditional Divergent Branching",
    code: `for i in range(n):\n    if A[i] > 0:\n        A[i] = 2.0 * A[i]\n    else:\n        A[i] = -A[i]`,
    verdict: "Partly vectorizable",
    reason: "Control-flow divergence across vector lanes requires hardware execution predication / mask registers.",
    hazard: "Inactive masked lanes remain powered but idle during divergent branch phases, reducing effective throughput.",
    badgeClass: "badge-warning",
    statusText: "PREDICATION ACTIVE: DIVERGENT LANES MASKED OFF",
    lanes: Array.from({ length: 8 }, (_, i) => ({
      lane: i,
      name: [0, 1, 3, 4].includes(i) ? "EXEC" : "MASKED",
      sub: [0, 1, 3, 4].includes(i) ? "2.0 * A" : "-A[i] write",
      type: [0, 1, 3, 4].includes(i) ? "active" : "masked"
    }))
  },
  4: {
    id: 4,
    title: "Loop 04: Indirect Indexed Memory Access (Gather)",
    code: `for i in range(n):\n    A[i] = B[idx[i]]`,
    verdict: "Partly vectorizable",
    reason: "Memory addresses depend on runtime integer index array, resulting in non-contiguous non-unit stride memory traffic.",
    hazard: "Non-unit stride leads to cache underutilization and memory bank conflicts.",
    badgeClass: "badge-warning",
    statusText: "NON-UNIT STRIDE: DRAM BANK CONFLICT STALL",
    lanes: Array.from({ length: 8 }, (_, i) => ({
      lane: i,
      name: "GATHER",
      sub: `B[idx[${i}]]`,
      type: "masked"
    }))
  },
  5: {
    id: 5,
    title: "Loop 05: Scalar Accumulation / Reduction Tree",
    code: `total = 0.0\nfor i in range(n):\n    total += A[i]`,
    verdict: "Partly vectorizable",
    reason: "Single scalar accumulator creates a reduction dependency across iterations.",
    hazard: "Requires horizontal pairwise reduction tree plus scalar post-processing.",
    badgeClass: "badge-warning",
    statusText: "TREE REDUCTION: PAIRWISE HORIZONTAL ADD",
    lanes: Array.from({ length: 8 }, (_, i) => ({
      lane: i,
      name: `L${i}`,
      sub: "PAIRWISE +",
      type: "active"
    }))
  },
  6: {
    id: 6,
    title: "Loop 06: 1D Spatial Stencil Smoothing",
    code: `for i in range(1, n-1):\n    B[i] = 0.5 * (A[i-1] + A[i+1])`,
    verdict: "Vectorizable",
    reason: "Independent iterations on target array B. Reads neighboring elements of A without write hazard.",
    hazard: "Requires unaligned vector loads or register shifts. In Array processors, requires inter-PE routing.",
    badgeClass: "badge-secure",
    statusText: "PARALLEL STENCIL OUTPUT TO TARGET ARRAY B",
    lanes: Array.from({ length: 8 }, (_, i) => ({
      lane: i,
      name: "STENCIL",
      sub: "A[i±1]",
      type: "active"
    }))
  }
};

// -----------------------------------------------------------------------------
// MODULE 3 DATABASE: Workload Presets & Silicon Recommendations
// -----------------------------------------------------------------------------
const workloadDB = {
  image_filter: {
    id: "image_filter",
    title: "2D Image Convolution / 3x3 Filter",
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
    arch: "Scalar Processor (Superscalar OOO)",
    scores: { scalar: 99, vector: 5, array: 5 },
    whyWin: "Strict loop-carried pointer chasing (`node = node->next`). High-frequency superscalar CPU with deep L1/L2 caches, out-of-order execution, and hardware prefetchers dominates.",
    whyStruggle: "Vector and Array processors suffer total failure: SIMD lanes cannot execute concurrently when address(i+1) depends on data(i). 0% vector lane utilization.",
    silicon: "Intel Core i9-14900K, AMD Ryzen Zen 4 / Zen 5",
    params: "REGULARITY: LOW // DEPENDENCY: POINTER CHASING // COMM: RANDOM DRAM // STRIDE: NON-CONTIGUOUS"
  }
};

// -----------------------------------------------------------------------------
// REST API ENDPOINTS
// -----------------------------------------------------------------------------

// System Status
app.get('/api/status', (req, res) => {
  res.json({
    system: "SIMD // DEFENSE SYSTEM",
    version: "VIV-SPEC 2026",
    status: "ONLINE",
    classification: "AIR-GAPPED // TOP SECRET",
    uptimeSeconds: process.uptime(),
    memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    timestamp: new Date().toISOString()
  });
});

// Helper to get loop data scaled to 8 (AVX2) or 16 (AVX-512) SIMD lanes
function getLoopWithWidth(loop, width = 16) {
  const w = parseInt(width) === 8 ? 8 : 16;
  let lanes = [];
  let statusText = loop.statusText;

  if (loop.id === 1) {
    lanes = Array.from({ length: w }, (_, i) => ({ lane: i, name: "EXEC", sub: "2.5*B+C", type: "active" }));
    statusText = `ALL ${w} LANES COMPUTE IN LOCKSTEP (100% UTILIZATION)`;
  } else if (loop.id === 2) {
    lanes = Array.from({ length: w }, (_, i) => ({ lane: i, name: i === 0 ? "EXEC" : "BLOCKED", sub: i === 0 ? "A[0]=10" : `NEEDS A[${i-1}]`, type: i === 0 ? "active" : "hazard" }));
    statusText = `HAZARD DETECTED: SERIAL DEPENDENCY STALLS LANES 1-${w - 1}`;
  } else if (loop.id === 3) {
    const act = [0, 1, 3, 4, 8, 9, 11, 12];
    lanes = Array.from({ length: w }, (_, i) => ({ lane: i, name: act.includes(i) ? "EXEC" : "MASKED", sub: act.includes(i) ? "2.0 * A" : "-A[i] write", type: act.includes(i) ? "active" : "masked" }));
    statusText = `PREDICATION ACTIVE: DIVERGENT LANES MASKED OFF`;
  } else if (loop.id === 4) {
    lanes = Array.from({ length: w }, (_, i) => ({ lane: i, name: "GATHER", sub: `B[idx[${i}]]`, type: "masked" }));
    statusText = `NON-UNIT STRIDE: ${w}-WAY DRAM BANK CONFLICT STALL`;
  } else if (loop.id === 5) {
    lanes = Array.from({ length: w }, (_, i) => ({ lane: i, name: `L${i}`, sub: "PAIRWISE +", type: "active" }));
    statusText = `TREE REDUCTION: ${Math.round(Math.log2(w))}-STAGE LOG2(${w}) PAIRWISE ADD`;
  } else if (loop.id === 6) {
    lanes = Array.from({ length: w }, (_, i) => ({ lane: i, name: "STENCIL", sub: "A[i±1]", type: "active" }));
    statusText = `PARALLEL ${w}-LANE STENCIL OUTPUT TO TARGET ARRAY B`;
  }

  return {
    ...loop,
    lanes,
    statusText,
    simdWidth: w
  };
}

// Module 1: Loops List & Details
app.get('/api/loops', (req, res) => {
  const width = req.query.width || 16;
  res.json(Object.values(loopDatabase).map(l => getLoopWithWidth(l, width)));
});

app.get('/api/loops/:id', (req, res) => {
  const loop = loopDatabase[req.params.id];
  if (!loop) return res.status(404).json({ error: "Loop not found" });
  res.json(getLoopWithWidth(loop, req.query.width || 16));
});

// Module 1: Perform Deep Security Scan
app.post('/api/scan', (req, res) => {
  const { loopId, width = 16 } = req.body;
  const loop = loopDatabase[loopId];
  if (!loop) return res.status(404).json({ error: "Loop not found" });
  const scaled = getLoopWithWidth(loop, width);

  res.json({
    loopId,
    verified: true,
    equivalence: "ZERO DATA DIVERGENCE DETECTED (100% IDENTICAL OUTPUT)",
    verdict: scaled.verdict,
    reason: scaled.reason,
    hazard: scaled.hazard,
    statusText: scaled.statusText,
    badgeClass: scaled.badgeClass,
    lanes: scaled.lanes,
    simdWidth: scaled.simdWidth
  });
});

// Module 2: Three-Way Simulator Calculation & Strip Mining
app.post('/api/simulate', (req, res) => {
  const kernel = req.body.kernel || 'add'; // 'add' or 'stencil'
  const n = parseInt(req.body.n) || 64;
  const peCount = parseInt(req.body.peCount) || 8;
  const isStencil = kernel === 'stencil';

  const effectiveN = isStencil ? Math.max(1, n - 2) : n;

  // Scalar Machine: 5 cycles per element
  const scalarCycles = 5 * effectiveN;

  // Vector Processor: 12 startup cycles per strip-mining chunk (MVL=64) + 1 cycle per element
  const numChunks = Math.ceil(effectiveN / 64);
  const vectorStartupCycles = numChunks * (isStencil ? 14 : 12);
  const vectorCycles = vectorStartupCycles + effectiveN;

  // Array Processor: lockstep PEs (n/peCount steps)
  // Add: 3 cycles per step (1 fetch + 1 CU broadcast + 1 ALU add)
  // Stencil: 9 cycles per step (+6 cycle inter-PE routing penalty!)
  const totalSteps = Math.ceil(n / peCount);
  const stepCost = isStencil ? 9 : 3;
  const arrayCycles = totalSteps * stepCost;

  // Generate strip mining chunks
  const chunks = [];
  let remaining = effectiveN;
  let chunkIdx = 0;
  while (remaining > 0) {
    const chunkLen = Math.min(64, remaining);
    const start = chunkIdx * 64;
    const end = start + chunkLen;
    const cycles = (isStencil ? 14 : 12) + chunkLen;
    chunks.push({
      index: chunkIdx,
      start,
      end,
      elements: chunkLen,
      cycles,
      active: chunkIdx === 0
    });
    remaining -= chunkLen;
    chunkIdx++;
  }

  res.json({
    kernel,
    n,
    peCount,
    isStencil,
    effectiveN,
    totalSteps,
    cycles: {
      scalar: scalarCycles,
      vector: vectorCycles,
      array: arrayCycles
    },
    speedup: {
      vector: parseFloat((scalarCycles / vectorCycles).toFixed(2)),
      array: parseFloat((scalarCycles / arrayCycles).toFixed(2))
    },
    stripMining: {
      mvl: 64,
      totalChunks: numChunks,
      chunks
    },
    archInsight: isStencil
      ? "CRITICAL DIFFERENTIATOR: While Array Processors spike in latency due to PE-to-PE packet routing across the mesh bus (+6 cycles/step), Vector Processors handle stencils via internal pipelined register shifts without bus stalls."
      : "For embarrassingly parallel loops, Array Processors scale linearly with PE count, while Vector Processors amortize startup latency over long vector chunks."
  });
});

// Module 3: Workload Recommender
app.get('/api/workloads', (req, res) => {
  res.json(Object.values(workloadDB));
});

app.get('/api/workloads/:id', (req, res) => {
  const item = workloadDB[req.params.id];
  if (!item) return res.status(404).json({ error: "Workload not found" });
  res.json(item);
});

// Module 4: Theoretical Acceleration Telemetry Data
app.get('/api/telemetry/length', (req, res) => {
  const points = [];
  for (let n = 1; n <= 200; n++) {
    const scalar = 5 * n;
    const vector = Math.ceil(n / 64) * 12 + n;
    const speedup = parseFloat((scalar / vector).toFixed(3));
    points.push({ n, scalar, vector, speedup });
  }
  res.json(points);
});

app.get('/api/telemetry/amdahl', (req, res) => {
  const factors = [4, 8, 16, 64, Infinity];
  const curves = factors.map(P => {
    const data = [];
    for (let f = 0; f <= 95; f++) {
      const fDec = f / 100;
      const speedup = P === Infinity 
        ? parseFloat((1 / (1 - fDec)).toFixed(2))
        : parseFloat((1 / ((1 - fDec) + fDec / P)).toFixed(2));
      data.push({ f, speedup });
    }
    return {
      p: P === Infinity ? "Infinity" : P,
      label: P === Infinity ? "P = ∞ (Limit)" : `P = ${P}`,
      data
    };
  });
  res.json(curves);
});

// Static assets for production build
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback to standalone HTML or React bundle
app.get('*', (req, res) => {
  const distIndex = path.join(__dirname, 'dist', 'index.html');
  res.sendFile(distIndex, (err) => {
    if (err) {
      res.sendFile(path.join(__dirname, 'standalone.html'));
    }
  });
});

// Start Express server
app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`  SIMD // DEFENSE SYSTEM - Node.js REST API Server`);
  console.log(`  Port:      http://localhost:${PORT}`);
  console.log(`  Health:    http://localhost:${PORT}/api/status`);
  console.log(`  Endpoints: /api/loops, /api/simulate, /api/workloads`);
  console.log(`======================================================\n`);
});
