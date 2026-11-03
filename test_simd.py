"""
Automated Test Suite for SIMD Explorer
Validates mathematical correctness, cycle counts, classification accuracy,
and visualizer generation according to Gravitas verification hierarchy.
"""

import os
import pytest
import numpy as np

from analyzer import VectorizabilityAnalyzer
from simulator import SIMDSimulator
from recommender import ApplicationRecommender
from visualizer import SpeedupVisualizer


def test_module_1_all_six_loops():
    """Validates all 6 sample loops for numerical equivalence and classification."""
    analyzer = VectorizabilityAnalyzer(n=32)
    expected_classifications = {
        1: "Vectorizable",
        2: "Not vectorizable",
        3: "Partly vectorizable",
        4: "Partly vectorizable",
        5: "Partly vectorizable",
        6: "Vectorizable",
    }

    for loop_id, expected_cls in expected_classifications.items():
        res = analyzer.analyze_loop(loop_id)
        assert res.loop_id == loop_id
        assert res.classification == expected_cls, f"Loop {loop_id} failed classification: expected {expected_cls}, got {res.classification}"
        assert res.results_match is True, f"Loop {loop_id} numerical results failed to match between scalar and vector!"
        assert len(res.reason) > 10
        assert len(res.architectural_bottleneck) > 10


def test_module_2_cycle_counts_n64():
    """Validates exact cycle counts for n=64 as specified in prompt."""
    sim = SIMDSimulator()
    res = sim.simulate_vector_add(n=64)

    # Prompt specification:
    # Scalar: ~5 cycles/elem => 320 for n=64
    # Vector: 12 startup + 1/elem => 76 for n=64
    # Array: 8 PEs lockstep
    assert res.scalar_cycles == 320, f"Expected 320 scalar cycles, got {res.scalar_cycles}"
    assert res.vector_cycles == 76, f"Expected 76 vector cycles, got {res.vector_cycles}"
    assert len(res.strip_chunks) == 1
    assert res.strip_chunks[0].length == 64
    assert res.strip_chunks[0].cycles == 76
    assert res.speedup_vector_vs_scalar == round(320 / 76, 2)


def test_module_2_strip_mining_n200():
    """Validates strip mining chunking for n=200 (64 + 64 + 64 + 8)."""
    sim = SIMDSimulator()
    res = sim.simulate_vector_add(n=200)

    chunk_lengths = [c.length for c in res.strip_chunks]
    assert chunk_lengths == [64, 64, 64, 8], f"Expected [64, 64, 64, 8], got {chunk_lengths}"
    assert sum(chunk_lengths) == 200

    # Cycles: (12+64) + (12+64) + (12+64) + (12+8) = 76 + 76 + 76 + 20 = 248
    assert res.vector_cycles == 248, f"Expected 248 vector cycles, got {res.vector_cycles}"
    assert res.scalar_cycles == 1000, f"Expected 1000 scalar cycles, got {res.scalar_cycles}"


def test_module_2_stencil_case():
    """Validates that Stencil case demonstrates inter-PE communication penalty on Array Processor."""
    sim = SIMDSimulator()
    res_add = sim.simulate_vector_add(n=64)
    res_stencil = sim.simulate_stencil(n=64)

    # In stencil case, array processor must take significantly more cycles than vector add due to neighbor comm hops
    assert res_stencil.array_cycles > res_add.array_cycles, (
        f"Stencil cycles ({res_stencil.array_cycles}) should exceed vector add cycles ({res_add.array_cycles}) "
        "due to inter-PE communication penalty!"
    )
    # Check that communication notes exist for active PEs
    active_pes = [p for p in res_stencil.pe_grid_steps[0] if p.is_active]
    assert len(active_pes) > 0
    assert any("fetches" in p.comm_note for p in active_pes)


def test_module_3_recommender():
    """Validates workload recommendation engine."""
    rec = ApplicationRecommender()

    # Linked list must recommend Scalar Processor
    res_ll = rec.evaluate_workload("linked_list")
    assert "Scalar" in res_ll.recommended_architecture
    assert res_ll.scores["Scalar"] > res_ll.scores["Vector"]

    # Database query must recommend Vector Processor
    res_db = rec.evaluate_workload("database_query")
    assert "Vector" in res_db.recommended_architecture

    # Image filter, matrix multiply, and grid physics should recommend Array Processor
    res_img = rec.evaluate_workload("image_filter")
    assert "Array" in res_img.recommended_architecture

    res_mat = rec.evaluate_workload("matrix_multiply")
    assert "Array" in res_mat.recommended_architecture

    res_phy = rec.evaluate_workload("grid_physics")
    assert "Array" in res_phy.recommended_architecture


def test_module_4_visualizer():
    """Validates that plots generate and save correctly."""
    vis = SpeedupVisualizer()
    out_file = "test_graphs.png"
    if os.path.exists(out_file):
        os.remove(out_file)

    saved_path = vis.generate_combined_figures(out_file)
    assert os.path.exists(saved_path)
    assert os.path.getsize(saved_path) > 1000  # Non-empty PNG image
    if os.path.exists(out_file):
        os.remove(out_file)


if __name__ == "__main__":
    pytest.main(["-v", "test_simd.py"])
