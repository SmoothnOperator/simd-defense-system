# SIMD // DEFENSE SYSTEM
### Real-Time Computer Architecture & SIMD Vectorization Telemetry HUD

[![React](https://img.shields.io/badge/React-18.3.1-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white)](https://python.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-00ff88.svg)](LICENSE)

A high-assurance, interactive hardware telemetry platform designed to simulate, benchmark, and compare computing architectures across **Scalar CPUs**, **Vector Pipelined Units (SIMD Registers)**, and **Array Processors (Lockstep PE Systolic Mesh)**.

Features a dual-platform architecture: a modern **React 18 + Vite** command HUD and a zero-dependency **offline standalone single-file distribution** (`standalone.html`).

---

## ⚡ Key Highlights & Systems

- **🔬 Module 01: Vectorizability Analyzer & Custom AST Sandbox**:
  - Live dependency audit across industrial kernels: SAXPY, RAW Recurrence (Fibonacci/Prefix scan), Branch Divergence (predication masking), Indirect Gather/Scatter, and Reduction Trees.
  - Interactive C-Loop code editor with real-time AST syntax parsing and dynamic 8-lane (AVX2) / 16-lane (AVX-512) hardware mapping.
- **⚙️ Module 02: Three-Way Simulator & Inter-PE Grid**:
  - Cycle-accurate execution comparison: Scalar ($5c \times n$) vs Vector ($\lceil n / 64 \rceil \cdot 12 + n$) vs Array ($\lceil n / P \rceil \cdot \text{cycles}$).
  - Switchable topology: **1D Linear Bus** vs **4×4 2D Torus Mesh** with multi-directional (North, South, East, West) packet routing animations.
  - Non-overlapping PE geometry with two-tier staggered label tiers for 16 PEs.
  - **🏎️ 3-Way Hardware Drag Race Arena**: Live animated cycle benchmark with progress bars and winner podium.
  - **🎛️ Time-Travel Cycle Scrubber**: Drag through simulation cycles to inspect instantaneous PE states and register file dumps (`V0`, `V1`, `V2`).
- **💡 Module 03: Workload Recommender & Silicon Decision Engine**:
  - Rule-based microarchitectural classifier evaluating spatial regularity, data reuse density, and memory stride.
  - Evaluates workloads: 2D Image Convolution, Dense GEMM Matrix Multiply, Grid Physics (PDE Lattice), Columnar DB Scan, and Linked List Pointer Chasing.
  - Automatic `[🚀 DEPLOY TO SIMULATOR]` parameter injection.
- **📈 Module 04: 60 FPS Running Acceleration Telemetry**:
  - **Startup Amortization Curve**: Sawtooth efficiency drops at $n=65, 129, 193$ (+12-cycle vector chunk penalty).
  - **Amdahl's Law Telemetry**: Speedup limits across $P=4, 8, 16, 64, \infty$.
  - **Roofline Model**: Memory Bandwidth Ceiling (64 GB/s) vs Peak SIMD Compute Ceiling (96 GFLOP/s) with knee point at 1.5 FLOP/B.
  - **Live Running Visuals**: Real-time laser scanning radar beam with phosphor persistence trail, 4 traveling photon sparks along curves, multi-color neon gradients, and `[⚡ AUTO-SWEEP]` autonomous oscillation.
- **🔊 Web Audio Synthesizer Oscilloscope**: Real-time procedural audio synthesis and live time-domain acoustic HUD waveform monitor.
- **⌨️ Global Command Keyboard Hotkeys**: `[1]`-`[4]` tab switching, `[SPACE]` play/pause, `[→]` step, `[R]` reset.

---

## 🚀 Quick Start Guide

### 1. Launch the React 18 + Vite HUD
```bash
# Clone the repository
git clone https://github.com/your-username/simd-defense-system.git
cd simd-defense-system

# Install dependencies
npm install

# Start the Vite development server (Port 3000)
npm run dev
```
*Open `http://localhost:3000` in any modern web browser.*

### 2. Run the Node.js Express Backend
```bash
# Start the Node.js REST API server (Port 5000)
npm run server
```

### 3. Open the Offline Standalone Single-File Version
Simply double-click [`standalone.html`](standalone.html) or open it in Chrome, Edge, or Firefox.
*Requires zero build tools, no Node.js, and no internet connection.*

### 4. Run the Python CLI & Test Suite
```bash
# Run the interactive CLI menu
python simd_explorer.py

# Run the automated verification test suite
python -m pytest test_simd.py
```

---

## 📂 Repository Structure

```
simd-defense-system/
├── src/                          # React 18 Modular Frontend
│   ├── components/
│   │   ├── Header.jsx            # HUD Header with Audio Oscilloscope
│   │   ├── AnalyzerTab.jsx       # Module 1: Vectorizability & AST Sandbox
│   │   ├── SimulatorTab.jsx      # Module 2: 3-Way Simulator, 2D Mesh & Drag Race
│   │   ├── RecommenderTab.jsx    # Module 3: Workload Decision Engine
│   │   └── TelemetryTab.jsx      # Module 4: 60 FPS Running Telemetry & Roofline
│   ├── utils/
│   │   └── sound.js              # Web Audio Synthesizer Engine
│   ├── App.jsx                   # Main Shell & Keyboard Hotkeys
│   ├── main.jsx                  # React DOM Entry
│   └── index.css                 # Cybernetic HUD Theme & Design System
├── standalone.html               # Zero-Dependency Single-File Offline App
├── server.js                     # Node.js Express REST API Server
├── test_simd.py                  # Pytest Invariant & Math Verification Suite
├── analyzer.py                   # Python Module 1 CLI Engine
├── simulator.py                  # Python Module 2 CLI Engine
├── recommender.py                # Python Module 3 CLI Engine
├── visualizer.py                 # Python Module 4 Matplotlib Telemetry Engine
├── simd_explorer.py              # Unified Interactive CLI Menu
├── package.json                  # Node.js Dependencies & Scripts
├── vite.config.js                # Vite Configuration & Proxy
└── README.md                     # Documentation
```

---

## 📊 Theoretical Model Formulation

### Vector Pipelining Model
$$\text{Cycles}_{\text{Vector}} = \left\lceil \frac{n}{\text{MVL}} \right\rceil \times S + n$$
Where:
- $\text{MVL} = 64$ (Maximum Vector Register Length)
- $S = 12$ (Pipeline startup & operand fetch fill latency)
- $n = \text{Vector length (elements)}$

### Array Processor Model (Lockstep PE Mesh)
$$\text{Cycles}_{\text{Array}} = \left\lceil \frac{n}{P} \right\rceil \times (\text{Op Cycles} + \text{Comm Cycles})$$
Where:
- $P = \text{Number of physical PEs (4, 8, or 16)}$
- $\text{Comm Cycles} = 6$ during 1D/2D spatial neighbor stencils ($B[i] = A[i-1] + A[i+1]$)

### Amdahl's Law Speedup Limit
$$S(f) = \frac{1}{(1 - f) + \frac{f}{P}}$$
Where $f$ is the vectorizable fraction. As $P \to \infty$, $S_{\infty} = \frac{1}{1 - f}$.

### Roofline Model Formulation
$$\text{Attainable Performance} = \min\left(P_{\text{peak}}, I \times \beta\right)$$
Where:
- $P_{\text{peak}} = 96\text{ GFLOP/s}$ (Peak SIMD compute saturation ceiling)
- $\beta = 64\text{ GB/s}$ (DRAM memory bandwidth ceiling)
- $I = \text{Arithmetic intensity (FLOPs/Byte)}$
- Knee point: $I^* = \frac{P_{\text{peak}}}{\beta} = \frac{96}{64} = 1.50\text{ FLOP/Byte}$

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|---|---|
| `[1]` | Switch to **Module 1 (Vectorizability Analyzer)** |
| `[2]` | Switch to **Module 2 (Three-Way Simulator)** |
| `[3]` | Switch to **Module 3 (Application Recommender)** |
| `[4]` | Switch to **Module 4 (Running Telemetry)** |
| `[SPACE]` | Play / Pause Simulation Animation |
| `[→]` | Single-Step Simulation Cycle |
| `[R]` | Reset Simulation State |

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.
