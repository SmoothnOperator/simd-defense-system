"""
SIMD Explorer: Unified Educational Platform
Covers all 3 core learning outcomes (Identify, Compare, Propose)
and the 5 assessed presentation components for your group project.

Modules:
  1. Vectorizability Analyzer (Identify)
  2. Vector vs Array vs Scalar Simulator (Compare & Worked Example)
  3. Application Recommender (Propose & Real-world Workloads)
  4. Speedup Graph Visualizer (Figures & Amdahl's Law)
"""

import sys
import os
import argparse
from typing import Optional

from analyzer import VectorizabilityAnalyzer
from simulator import SIMDSimulator
from recommender import ApplicationRecommender
from visualizer import SpeedupVisualizer


def print_header(title: str, subtitle: Optional[str] = None):
    border = "=" * 76
    print(f"\n{border}")
    print(f"  {title.center(72)}")
    if subtitle:
        print(f"  {subtitle.center(72)}")
    print(f"{border}\n")


def run_module_1(interactive: bool = True):
    print_header(
        "MODULE 1: VECTORIZABILITY ANALYZER (Outcome: IDENTIFY)",
        "Identifies parallel patterns, dependency hazards & masking overhead",
    )
    analyzer = VectorizabilityAnalyzer(n=16)
    loops = analyzer.get_all_loops()

    if interactive:
        print("Select a sample loop to analyze:")
        for lp in loops:
            print(f"  [{lp['id']}] {lp['name']} -> {lp['summary']}")
        print("  [7] Run all 6 loops sequentially")

        choice = input("\nEnter choice [1-7] (default 7): ").strip()
        if not choice:
            choice = "7"
    else:
        choice = "7"

    selected_ids = list(range(1, 7)) if choice == "7" else [int(choice)] if choice.isdigit() and 1 <= int(choice) <= 6 else [1]

    for lid in selected_ids:
        res = analyzer.analyze_loop(lid)
        status_tag = f"[{res.classification.upper()}]"
        print("-" * 76)
        print(f"Loop #{res.loop_id}: {res.name}")
        print(f"Status: {status_tag}")
        print(f"Code Pattern:\n    {res.code_snippet.replace(chr(10), chr(10) + '    ')}")
        print(f"Reason:                  {res.reason}")
        print(f"Architectural Hazard:    {res.architectural_bottleneck}")
        print(f"NumPy vs Scalar Match:   {res.results_match} (Scalar sample: {res.scalar_sample} | Vector: {res.vector_sample})")
        print(f"Scalar time: {res.scalar_time_ms:.4f} ms | Vector time: {res.vector_time_ms:.4f} ms")


def run_module_2(interactive: bool = True):
    print_header(
        "MODULE 2: ARCHITECTURAL SIMULATOR (Outcome: COMPARE)",
        "Scalar vs Vector vs Array (C = A + B & Stencil Inter-PE Comm)",
    )
    sim = SIMDSimulator()

    n = 64
    if interactive:
        n_input = input("Enter vector length n for C = A + B simulation (e.g. 64 or 200) [default 64]: ").strip()
        if n_input.isdigit() and int(n_input) > 0:
            n = int(n_input)

    res = sim.simulate_vector_add(n=n)

    print(f"\n--- EXPERIMENT 1: Vector Addition (C = A + B) for n = {n} ---")
    print(f"1. SCALAR PROCESSOR:")
    print(f"   - Model:  {res.scalar_model_desc}")
    print(f"   - Cycles: {res.scalar_cycles} cycles")
    print(f"2. VECTOR PROCESSOR (Cray-style pipelined registers, MVL=64):")
    print(f"   - Model:  {res.vector_model_desc}")
    print(f"   - Cycles: {res.vector_cycles} cycles (Speedup vs Scalar: {res.speedup_vector_vs_scalar}x)")
    print(f"   - Strip-Mining Chunks: {len(res.strip_chunks)} chunk(s)")
    chunk_lengths = " + ".join(str(c.length) for c in res.strip_chunks)
    print(f"     Equation: {chunk_lengths} = {n}")
    for c in res.strip_chunks:
        print(f"     * Chunk {c.chunk_index} [idx {c.start_idx}:{c.end_idx}]: {c.length} elements -> {c.cycles} cycles")
        print(f"       Reg V0 (A): {c.reg_v0_sample} ...")
        print(f"       Reg V1 (B): {c.reg_v1_sample} ...")
        print(f"       Reg V2 (C): {c.reg_v2_sample} ...")

    print(f"\n3. ARRAY PROCESSOR (8 PEs operating in lockstep SIMD):")
    print(f"   - Model:  {res.array_model_desc}")
    print(f"   - Cycles: {res.array_cycles} cycles (Speedup vs Scalar: {res.speedup_array_vs_scalar}x)")
    print(f"   - PE Grid State Table (First 2 Steps shown):")
    for step_pes in res.pe_grid_steps[:2]:
        step_idx = step_pes[0].step_index
        pe_summary = " | ".join(f"PE{p.pe_id}:elem{p.element_index}" if p.is_active else f"PE{p.pe_id}:IDLE" for p in step_pes)
        print(f"     Step {step_idx}: {pe_summary}")

    print(f"\nInsight: {res.architectural_insight}")

    # STENCIL CASE
    print("\n" + "-" * 76)
    print("--- EXPERIMENT 2: 1D Stencil B[i] = A[i-1] + A[i+1] (THE CRITICAL DIFFERENTIATOR) ---")
    res_stencil = sim.simulate_stencil(n=n)
    print(f"Scalar Cycles:  {res_stencil.scalar_cycles} cycles")
    print(f"Vector Cycles:  {res_stencil.vector_cycles} cycles (Registers shift internally; no network stall)")
    print(f"Array Cycles:   {res_stencil.array_cycles} cycles (Cycles spike due to inter-PE network hops!)")
    print(f"\nArray PE Communication Trace (Step 0):")
    for pe_state in res_stencil.pe_grid_steps[0]:
        if pe_state.is_active:
            print(f"  PE {pe_state.pe_id} (element {pe_state.element_index}): {pe_state.comm_note}")
    print(f"\nViva Talking Point:\n  {res_stencil.architectural_insight}")


def run_module_3(interactive: bool = True):
    print_header(
        "MODULE 3: APPLICATION RECOMMENDER (Outcome: PROPOSE)",
        "Maps workloads to optimal architectures with rule reasoning",
    )
    rec = ApplicationRecommender()
    presets = rec.get_presets()

    if interactive:
        print("Select a workload to evaluate:")
        keys = list(presets.keys())
        for idx, key in enumerate(keys, 1):
            print(f"  [{idx}] {presets[key]['name']}")
        print(f"  [{len(keys) + 1}] Evaluate ALL 5 standard workloads")

        choice = input(f"\nEnter choice [1-{len(keys) + 1}] (default {len(keys) + 1}): ").strip()
        if not choice:
            choice = str(len(keys) + 1)
    else:
        choice = str(len(presets) + 1)

    keys_to_run = list(presets.keys()) if choice == str(len(presets) + 1) else [list(presets.keys())[int(choice) - 1]] if choice.isdigit() and 1 <= int(choice) <= len(presets) else list(presets.keys())

    for k in keys_to_run:
        res = rec.evaluate_workload(k)
        print("-" * 76)
        print(f"WORKLOAD: {res.workload_name}")
        print(f"  Characteristics: Regularity={res.regularity.upper()} | Dependency={res.dependency_pattern} | Comm={res.communication_needs}")
        print(f"  Hardware Scores: Scalar={res.scores['Scalar']}/100 | Vector={res.scores['Vector']}/100 | Array={res.scores['Array']}/100")
        print(f"  PROPOSED ARCHITECTURE: >>> {res.recommended_architecture.upper()} <<<")
        print(f"  Why it wins:           {res.rationale_recommended}")
        print(f"  Why others struggle:   {res.rationale_alternative}")
        print(f"  Real-World Hardware:   {res.hardware_examples}")
        print(f"  Key Viva Defense:      {res.viva_defense_note}")


def run_module_4(interactive: bool = True):
    print_header(
        "MODULE 4: SPEEDUP GRAPH (FIGURES & AMDAHL'S LAW)",
        "Amortisation curves & vectorizable fraction ceilings",
    )
    vis = SpeedupVisualizer()
    out_file = "simd_speedup_graphs.png"
    saved = vis.generate_combined_figures(out_file)
    print(f"Successfully generated dual-panel presentation plot: '{saved}'")
    print("\nPlot 1 (Left): Speedup vs Vector Length (n)")
    print("  * For small n (n < 3), Scalar beats Vector because startup latency (12 cycles) is not yet amortized.")
    print("  * Vector shows strip-mining sawtooth steps at multiples of 64.")
    print("  * Array Processor achieves massive speedup for large arrays due to 8-lane parallel execution.")
    print("\nPlot 2 (Right): Amdahl's Law (Speedup vs Vectorizable Fraction f)")
    print("  * At f = 50%, maximum speedup is strictly capped at 2.0x, even with an infinite number of PEs!")
    print("  * At f = 90%, speedup ceiling is 10.0x because the sequential 10% dominates execution time.")
    print("  * Viva reflection: Demonstrates why algorithmic vectorizability is as critical as hardware scale.")


def run_presentation_walkthrough():
    print_header(
        "COMPLETE PRESENTATION & VIVA WALKTHROUGH",
        "Modular Flow: Module 1 (Identify) -> Module 2 (Compare) -> Modules 3 & 4 (Propose & Reflect)",
    )
    print("============================================================================")
    print("PHASE 1: MODULE 1 DEMONSTRATION (IDENTIFY)")
    print("============================================================================")
    run_module_1(interactive=False)

    input("\n[Press ENTER to advance to Module 2...]")

    print("\n============================================================================")
    print("PHASE 2: MODULE 2 DEMONSTRATION (COMPARE & WORKED EXAMPLES)")
    print("============================================================================")
    run_module_2(interactive=False)

    input("\n[Press ENTER to advance to Modules 3 & 4...]")

    print("\n============================================================================")
    print("PHASE 3: MODULES 3 & 4 DEMONSTRATION (PROPOSE, FIGURES & REFLECTION)")
    print("============================================================================")
    run_module_3(interactive=False)
    run_module_4(interactive=False)

    print("\n============================================================================")
    print("VIVA DEFENSE SUMMARY: 5 ASSESSED COMPONENTS COVERED")
    print("============================================================================")
    print("1. Concept explanation: Block models, Vector registers V0-V2, and 8-PE lockstep grid.")
    print("2. Worked example: n=64 cycle counts (320 vs 76 vs 24) and n=200 strip-mining (64+64+64+8).")
    print("3. Real-world application: Module 3 Recommender across 5 industry workloads.")
    print("4. Critical comparison: Stencil case highlighting inter-PE neighbor communication costs.")
    print("5. Demonstration & reflection: Live CLI/Web demo, Amdahl's law bottleneck, masking & bandwidth limits.")


def main():
    parser = argparse.ArgumentParser(description="SIMD Explorer - Architecture Educational Platform")
    parser.add_argument("--module", type=int, choices=[1, 2, 3, 4], help="Run a specific module (1-4)")
    parser.add_argument("--all", action="store_true", help="Run all modules non-interactively")
    parser.add_argument("--demo", action="store_true", help="Run full viva presentation walkthrough")
    args = parser.parse_args()

    if args.demo:
        run_presentation_walkthrough()
        return
    elif args.all:
        run_module_1(interactive=False)
        run_module_2(interactive=False)
        run_module_3(interactive=False)
        run_module_4(interactive=False)
        return
    elif args.module == 1:
        run_module_1(interactive=False)
        return
    elif args.module == 2:
        run_module_2(interactive=False)
        return
    elif args.module == 3:
        run_module_3(interactive=False)
        return
    elif args.module == 4:
        run_module_4(interactive=False)
        return

    # Interactive Menu
    while True:
        print_header("SIMD EXPLORER: MAIN MENU", "One Program, Three Modules, Viva-Ready")
        print("  [1] Module 1: Vectorizability Analyzer (Identify)")
        print("  [2] Module 2: Architectural Simulator (Compare: C = A + B & Stencil)")
        print("  [3] Module 3: Application Recommender (Propose: 5 Real-World Workloads)")
        print("  [4] Module 4: Speedup Graphs (Figures: Startup Amortisation & Amdahl's Law)")
        print("  [5] Run Complete Viva Presentation Walkthrough (Module 1 -> Module 2 -> Modules 3 & 4)")
        print("  [6] Launch Streamlit Web Prototype")
        print("  [0] Exit")

        choice = input("\nEnter choice [0-6]: ").strip()
        if choice == "1":
            run_module_1(interactive=True)
        elif choice == "2":
            run_module_2(interactive=True)
        elif choice == "3":
            run_module_3(interactive=True)
        elif choice == "4":
            run_module_4(interactive=True)
        elif choice == "5":
            run_presentation_walkthrough()
        elif choice == "6":
            print("\nLaunching Streamlit prototype website...")
            print("Run command: streamlit run app.py")
            os.system("streamlit run app.py")
        elif choice == "0":
            print("\nExiting SIMD Explorer. Good luck with your viva defense!")
            break
        else:
            print("\nInvalid choice. Please enter a number between 0 and 6.")


if __name__ == "__main__":
    main()
