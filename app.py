"""
SIMD Explorer - Interactive Web Prototype
A comprehensive, viva-ready web dashboard built with Streamlit.
Covers the 3 learning outcomes (Identify, Compare, Propose) and 5 presentation components.
"""

import streamlit as st
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

from analyzer import VectorizabilityAnalyzer
from simulator import SIMDSimulator
from recommender import ApplicationRecommender
from visualizer import SpeedupVisualizer

st.set_page_config(
    page_title="SIMD Explorer | Architecture & Vectorization Dashboard",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Custom High-Tech Privacy & Defense System HUD Styling
st.markdown(
    """
    <style>
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Orbitron:wght@600;700;800&display=swap');

    /* Global Dark Theme Overrides */
    .stApp {
        background: #030712 !important;
        color: #f8fafc !important;
        background-image: 
            radial-gradient(circle at 50% 0%, rgba(0, 242, 254, 0.08) 0%, transparent 60%),
            linear-gradient(rgba(0, 242, 254, 0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 242, 254, 0.02) 1px, transparent 1px) !important;
        background-size: 100% 100%, 40px 40px, 40px 40px !important;
    }

    .main-header {
        font-family: 'Orbitron', sans-serif;
        font-size: 2.3rem;
        font-weight: 800;
        letter-spacing: 2px;
        background: linear-gradient(90deg, #ffffff, #00f2fe);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 2px;
        text-transform: uppercase;
    }
    .sub-header {
        font-family: 'JetBrains Mono', monospace;
        font-size: 0.82rem;
        color: #00f2fe;
        letter-spacing: 1.5px;
        margin-bottom: 24px;
        text-transform: uppercase;
    }
    .hud-beacon {
        display: inline-block;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #10b981;
        box-shadow: 0 0 10px #10b981;
        margin-right: 8px;
    }
    .metric-card {
        background: rgba(15, 23, 42, 0.75);
        border: 1px solid rgba(0, 242, 254, 0.3);
        border-radius: 10px;
        padding: 16px;
        box-shadow: 0 0 15px rgba(0, 242, 254, 0.1);
    }
    .badge-vectorizable {
        background-color: rgba(16, 185, 129, 0.15);
        color: #34d399;
        border: 1px solid #10b981;
        padding: 6px 14px;
        border-radius: 20px;
        font-family: 'JetBrains Mono', monospace;
        font-weight: bold;
        letter-spacing: 1px;
    }
    .badge-partly {
        background-color: rgba(245, 158, 11, 0.15);
        color: #fbbf24;
        border: 1px solid #f59e0b;
        padding: 6px 14px;
        border-radius: 20px;
        font-family: 'JetBrains Mono', monospace;
        font-weight: bold;
        letter-spacing: 1px;
    }
    .badge-not {
        background-color: rgba(255, 0, 85, 0.15);
        color: #ff4d88;
        border: 1px solid #ff0055;
        padding: 6px 14px;
        border-radius: 20px;
        font-family: 'JetBrains Mono', monospace;
        font-weight: bold;
        letter-spacing: 1px;
    }
    div[data-testid="stMetricValue"] {
        font-family: 'Orbitron', sans-serif !important;
        color: #00f2fe !important;
        text-shadow: 0 0 10px rgba(0, 242, 254, 0.4);
    }
    div[data-testid="stMetricLabel"] {
        font-family: 'JetBrains Mono', monospace !important;
        font-size: 0.75rem !important;
        letter-spacing: 1px !important;
        color: #94a3b8 !important;
    }
    </style>
    """,
    unsafe_allow_html=True,
)

# Top Bar
st.markdown('<div class="main-header">⚡ SIMD // DEFENSE SYSTEM</div>', unsafe_allow_html=True)
st.markdown(
    '<div class="sub-header"><span class="hud-beacon"></span>AIR-GAPPED HIGH-ASSURANCE ARCHITECTURAL EXPLORATION HUD</div>',
    unsafe_allow_html=True,
)

# Sidebar: Presentation & Team Split Info
with st.sidebar:
    st.image("https://img.icons8.com/fluency/96/processor.png", width=64)
    st.title("Project Navigation")
    st.info(
        """
        **Modular Architecture Breakdown:**
        - **Module 1**: Vectorizability Analyzer (Identify)
        - **Module 2**: Architectural Simulator (Compare)
        - **Modules 3 & 4**: Recommender & Graphs (Propose)
        """
    )
    st.markdown("---")
    st.markdown("### 🎯 5 Assessed Components")
    st.markdown("1. **Concept explanation**: PE grids & register pipelining")
    st.markdown("2. **Worked example**: Cycle calculations ($n=64, 200$)")
    st.markdown("3. **Real-world application**: Workload recommender")
    st.markdown("4. **Critical comparison**: Stencil inter-PE comm")
    st.markdown("5. **Demonstration & reflection**: Live run + Amdahl's Law")
    st.markdown("---")
    st.caption("SIMD Explorer Prototype v1.0 | Academic Defense Edition")

# Tabs for the Modules
tabs = st.tabs([
    "🔍 Mod 1: Vectorizability (Identify)",
    "⚙️ Mod 2: Simulator (Compare)",
    "💡 Mod 3: Recommender (Propose)",
    "📈 Mod 4: Speedup & Amdahl Graphs",
    "🎓 Presentation & Viva Defense Guide",
])

# ==============================================================================
# TAB 1: VECTORIZABILITY ANALYZER
# ==============================================================================
with tabs[0]:
    st.header("Module 1: Vectorizability Analyzer")
    st.caption("Identifies parallelization potential, loop-carried hazards, masking, and memory strides.")

    analyzer = VectorizabilityAnalyzer()
    loops = analyzer.get_all_loops()
    loop_options = {f"Loop {lp['id']}: {lp['name']}": lp['id'] for lp in loops}

    if "scanned_loop_id" not in st.session_state:
        st.session_state.scanned_loop_id = None

    col_l1, col_l2 = st.columns([1, 1])
    with col_l1:
        st.subheader("Target Computational Loop")
        selected_loop_name = st.selectbox("Select Sample Loop", list(loop_options.keys()))
        selected_id = loop_options[selected_loop_name]
        n_elem = st.slider("Array Size (n)", min_value=8, max_value=64, value=16, step=8)

        # Show target code snippet
        dummy_res = analyzer.analyze_loop(selected_id, n=n_elem)
        st.code(dummy_res.code_snippet, language="python")

        run_btn = st.button("⚡ Run Deep Security Scan", type="primary", use_container_width=True)
        if run_btn:
            st.session_state.scanned_loop_id = selected_id

    with col_l2:
        st.subheader("Architectural Diagnostic Verdict")
        if st.session_state.scanned_loop_id == selected_id:
            result = analyzer.analyze_loop(selected_id, n=n_elem)
            badge_class = "badge-vectorizable" if result.classification == "Vectorizable" else "badge-partly" if "Partly" in result.classification else "badge-not"
            st.markdown(f"### Verdict: <span class='{badge_class}'>● {result.classification.upper()}</span>", unsafe_allow_html=True)
            st.markdown(f"**Equivalence Verification:** `{'✅ 100% Match (Zero Divergence)' if result.results_match else '❌ Divergence Detected'}`")
            
            st.markdown("#### 📌 Architectural Reasoning")
            st.info(result.reason)
            
            st.markdown("#### ⚠️ Critical Hardware Bottleneck")
            st.error(result.architectural_bottleneck)
            
            m_c1, m_c2 = st.columns(2)
            m_c1.metric("Scalar Loop Time", f"{result.scalar_time_ms:.4f} ms")
            m_c2.metric("Vectorized NumPy Time", f"{result.vector_time_ms:.4f} ms")
        else:
            st.markdown(
                """
                <div style="background: rgba(15, 23, 42, 0.6); border: 1px dashed rgba(0, 242, 254, 0.3); border-radius: 10px; padding: 36px 20px; text-align: center; margin-top: 10px;">
                    <div style="font-family: 'Orbitron', sans-serif; font-size: 1.1rem; color: #00f2fe; margin-bottom: 8px;">
                        DIAGNOSTIC SUBSYSTEM // STANDBY
                    </div>
                    <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; color: #94a3b8; line-height: 1.6;">
                        Target kernel loaded in memory buffer.<br>
                        Click <b>[⚡ Run Deep Security Scan]</b> to initiate dependency hazard inspection and reveal verdict.
                    </div>
                </div>
                """,
                unsafe_allow_html=True,
            )


# ==============================================================================
# TAB 2: ARCHITECTURAL SIMULATOR
# ==============================================================================
with tabs[1]:
    st.header("Module 2: Vector vs Array vs Scalar Simulator")
    st.caption("Simulates cycle-accurate execution models, strip-mining chunks, and PE neighbor routing.")

    col_ctrl1, col_ctrl2, col_ctrl3 = st.columns(3)
    with col_ctrl1:
        sim_problem = st.radio("Simulation Case", ["Vector Addition (C = A + B)", "1D Stencil (B[i] = A[i-1] + A[i+1])"])
    with col_ctrl2:
        n_val = st.number_input("Array Length (n)", min_value=8, max_value=512, value=64, step=8)
    with col_ctrl3:
        pe_val = st.selectbox("Array Processor PE Count", [4, 8, 16], index=1)

    sim = SIMDSimulator(array_pe_count=pe_val)
    is_stencil = "Stencil" in sim_problem

    if is_stencil:
        res_sim = sim.simulate_stencil(n=n_val)
    else:
        res_sim = sim.simulate_vector_add(n=n_val)

    st.markdown("### 📊 Performance Comparison")
    m1, m2, m3, m4 = st.columns(4)
    m1.metric("Scalar Processor", f"{res_sim.scalar_cycles} cycles", "Baseline (1.0x)")
    m2.metric("Vector Processor", f"{res_sim.vector_cycles} cycles", f"{res_sim.speedup_vector_vs_scalar}x Speedup")
    m3.metric(f"Array Processor ({pe_val} PEs)", f"{res_sim.array_cycles} cycles", f"{res_sim.speedup_array_vs_scalar}x Speedup")
    m4.metric("Array vs Vector", f"{res_sim.speedup_array_vs_vector}x", "Relative speedup")

    st.info(f"💡 **Architectural Insight:** {res_sim.architectural_insight}")

    col_v1, col_v2 = st.columns(2)
    with col_v1:
        st.subheader("📦 Vector Processor: Strip-Mining Inspector")
        st.markdown(f"**Model:** `{res_sim.vector_model_desc}`")
        st.markdown(f"Total Chunks: `{len(res_sim.strip_chunks)}` | Chunks: `{' + '.join(str(c.length) for c in res_sim.strip_chunks)} = {n_val}`")
        chunk_df = pd.DataFrame([
            {
                "Chunk #": c.chunk_index,
                "Range": f"[{c.start_idx}:{c.end_idx}]",
                "Length": c.length,
                "Cycles": c.cycles,
                "Reg V0 (A sample)": str(c.reg_v0_sample),
                "Reg V1 (B sample)": str(c.reg_v1_sample),
                "Reg V2 (C sample)": str(c.reg_v2_sample),
            }
            for c in res_sim.strip_chunks
        ])
        st.dataframe(chunk_df, use_container_width=True)

    with col_v2:
        st.subheader(f"🔲 Array Processor: {pe_val}-PE Grid State")
        st.markdown(f"**Model:** `{res_sim.array_model_desc}`")
        st.markdown(f"Total Lockstep Steps: `{len(res_sim.pe_grid_steps)}`")

        step_to_show = st.slider("Inspect PE Grid Step", 0, len(res_sim.pe_grid_steps) - 1, 0)
        selected_step_pes = res_sim.pe_grid_steps[step_to_show]

        pe_df = pd.DataFrame([
            {
                "PE Lane": f"PE {p.pe_id}",
                "Element Index": p.element_index if p.is_active else "IDLE (Masked)",
                "Active": "🟢 YES" if p.is_active else "⚪ MASKED",
                "Input A": p.val_a if p.is_active else "-",
                "Input B": p.val_b if p.is_active else "-",
                "Output C": p.val_c if p.is_active else "-",
                "Interconnect Activity": p.comm_note,
            }
            for p in selected_step_pes
        ])
        st.dataframe(pe_df, use_container_width=True)


# ==============================================================================
# TAB 3: APPLICATION RECOMMENDER
# ==============================================================================
with tabs[2]:
    st.header("Module 3: Application Recommender")
    st.caption("Rule-based architectural decision engine based on regularity, dependencies, and communication.")

    rec = ApplicationRecommender()
    presets = rec.get_presets()

    col_rec1, col_rec2 = st.columns([1, 2])
    with col_rec1:
        mode = st.radio("Input Mode", ["Standard Presets", "Custom Workload Builder"])
        if mode == "Standard Presets":
            selected_preset_key = st.selectbox(
                "Choose Workload",
                list(presets.keys()),
                format_func=lambda k: presets[k]["name"],
            )
            rec_result = rec.evaluate_workload(selected_preset_key)
        else:
            w_name = st.text_input("Workload Name", "Sparse Graph Traversal")
            reg = st.selectbox("Regularity", ["high", "medium", "low"], index=2)
            dep = st.selectbox("Dependencies", ["none", "neighbor_stencil", "reduction", "pointer_chasing"], index=3)
            size = st.selectbox("Data Size", ["small", "medium", "large", "massive"], index=1)
            comm = st.selectbox("Communication Needs", ["none", "neighbor_local", "broadcast_systolic", "global_random"], index=3)
            stride = st.selectbox("Memory Access Stride", ["unit_stride_contiguous", "strided_grid", "random_pointer"], index=2)
            rec_result = rec.evaluate_workload(custom_params={
                "name": w_name,
                "regularity": reg,
                "dependency": dep,
                "data_size": size,
                "comm_needs": comm,
                "memory_stride": stride,
            })

    with col_rec2:
        st.markdown(f"### Proposed Architecture: :blue[{rec_result.recommended_architecture.upper()}]")
        st.markdown(f"**Workload:** `{rec_result.workload_name}`")

        # Score Bars
        st.markdown("#### Hardware Suitability Scores")
        for arch, score in rec_result.scores.items():
            st.write(f"**{arch} Processor:** {score}/100")
            st.progress(score / 100.0)

        st.success(f"**Why {rec_result.recommended_architecture} wins:** {rec_result.rationale_recommended}")
        st.warning(f"**Why alternatives struggle:** {rec_result.rationale_alternative}")
        st.info(f"**Real-world Hardware Example:** {rec_result.hardware_examples}")
        st.caption(f"💡 {rec_result.viva_defense_note}")


# ==============================================================================
# TAB 4: SPEEDUP & AMDAHL'S LAW GRAPHS
# ==============================================================================
with tabs[3]:
    st.header("Module 4: Speedup Graph & Theoretical Limits")
    st.caption("Visualizes startup latency amortisation and Amdahl's Law speedup bottlenecks.")

    vis = SpeedupVisualizer()

    g_col1, g_col2 = st.columns(2)
    with g_col1:
        st.subheader("📈 Startup Cost Amortisation (Speedup vs n)")
        max_len = st.slider("Max Vector Length (n)", 32, 512, 256, step=32)
        fig1 = vis.generate_speedup_vs_length_figure(max_n=max_len)
        st.pyplot(fig1)
        st.caption(
            "Notice the strip-mining step at n=64. For n < 3, Scalar outperforms Vector "
            "because the 12-cycle pipeline startup has not yet been amortized over enough elements."
        )

    with g_col2:
        st.subheader("📉 Amdahl's Law (Speedup vs Vectorizable %)")
        fig2 = vis.generate_amdahl_figure()
        st.pyplot(fig2)
        st.caption(
            "Notice that even with infinite parallel speedup (P = ∞), if 10% of code is sequential "
            "(f = 90%), the maximum achievable speedup is strictly bounded by 10x."
        )


# ==============================================================================
# TAB 5: PRESENTATION & VIVA DEFENSE GUIDE
# ==============================================================================
with tabs[4]:
    st.header("🎓 Presentation Mapping & Viva Defense Guide")
    st.markdown(
        """
        This dashboard covers **all 5 required presentation components** and **all 3 learning outcomes**.
        Use this cheatsheet to ace your live presentation and viva questions.
        """
    )

    t1, t2 = st.columns(2)
    with t1:
        st.subheader("👥 Modular Presentation Breakdown")
        st.markdown(
            """
            - **Module 1 (Identify):**
              - Explains the 6 loop patterns.
              - Defends why true loop-carried RAW dependencies (`A[i] = A[i-1] + B[i]`) cannot be vectorized without parallel prefix scan.
              - Explains branch masking (predication) overhead and gather/scatter latency.

            - **Module 2 (Compare & Worked Example):**
              - Walks through cycle calculations for $n=64$ (Scalar: 320c, Vector: 76c, Array: 24c).
              - Shows strip-mining equation for $n=200$ ($64 + 64 + 64 + 8 = 200$).
              - **Crucial viva point:** Presents the Stencil case ($B[i] = A[i-1] + A[i+1]$) and shows that Array Processors incur inter-PE neighbor communication penalties.

            - **Modules 3 & 4 (Propose, Figures & Demo):**
              - Explains the Recommender rule engine mapping workloads to hardware.
              - Presents the Speedup vs Length graph (amortisation) and Amdahl's law ceiling.
              - Drives the live interactive prototype demo during the presentation.
            """
        )

    with t2:
        st.subheader("❓ Anticipated Viva Questions & Model Answers")
        with st.expander("Q1: Why does Array Processor slow down on the Stencil case?"):
            st.write(
                "**Answer:** In an array processor, data is distributed across distinct processing elements. "
                "Computing A[i-1] + A[i+1] requires element i in PE_p to access data stored in PE_(p-1) and PE_(p+1). "
                "This requires routing over the inter-PE interconnection network (e.g. toroidal mesh), adding 6-8 cycles "
                "of communication and synchronization per step."
            )
        with st.expander("Q2: Why does Scalar beat Vector when n is very small (n < 3)?"):
            st.write(
                "**Answer:** Vector processors incur an initial startup latency (typically 12+ cycles) to prime "
                "the memory access and functional unit pipelines. When n=1, Vector takes 12 + 1 = 13 cycles, whereas "
                "Scalar executes in 5 cycles. The vector advantage only manifests once startup latency is amortized."
            )
        with st.expander("Q3: Can a loop with conditional branches (if-else) be vectorized?"):
            st.write(
                "**Answer:** Yes, via vector predication / mask registers (e.g., AVX-512 `k`-registers or ARM SVE). "
                "However, all execution paths are executed, and inactive lanes are disabled with write-masks. "
                "If branch divergence is high, SIMD efficiency drops proportionally."
            )
        with st.expander("Q4: Why does Amdahl's Law cap a 90% vectorizable program at 10x?"):
            st.write(
                "**Answer:** S(f) = 1 / ((1 - f) + f/P). As P approaches infinity, f/P approaches 0. "
                "Thus, S(f) approaches 1 / (1 - 0.90) = 1 / 0.10 = 10x. The remaining 10% scalar bottleneck "
                "dominates total runtime."
            )
