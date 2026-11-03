"""
Module 1: Vectorizability Analyzer (identify)
Evaluates sample computational loops for vectorizability (SIMD compatibility).
Runs scalar loop vs NumPy vectorized version, verifies numerical equivalence,
and outputs classification with in-depth architectural reasoning.
"""

from dataclasses import dataclass
from typing import Callable, Dict, Any, List, Tuple
import numpy as np


@dataclass
class LoopAnalysisResult:
    loop_id: int
    name: str
    code_snippet: str
    classification: str  # 'Vectorizable', 'Partly vectorizable', 'Not vectorizable'
    reason: str
    architectural_bottleneck: str
    results_match: bool
    scalar_sample: Any
    vector_sample: Any
    scalar_time_ms: float
    vector_time_ms: float


class VectorizabilityAnalyzer:
    """Analyzes computational loops for vectorizability and verifies equivalence."""

    def __init__(self, default_n: int = 32, n: int = None):
        self.n = n if n is not None else default_n

    def get_all_loops(self) -> List[Dict[str, Any]]:
        """Returns metadata for all 6 sample loops."""
        return [
            {
                "id": 1,
                "name": "Independent Element-Wise Linear Combination (SAXPY)",
                "summary": "A[i] = 2.5 * B[i] + C[i]",
                "classification": "Vectorizable",
            },
            {
                "id": 2,
                "name": "Loop-Carried Dependency (Accumulative Recurrence / Prefix)",
                "summary": "A[i] = A[i-1] + B[i]",
                "classification": "Not vectorizable",
            },
            {
                "id": 3,
                "name": "Conditional Branching / Data-Dependent Threshold",
                "summary": "if A[i] > 0: A[i] = A[i] * 2 else: A[i] = -A[i]",
                "classification": "Partly vectorizable",
            },
            {
                "id": 4,
                "name": "Irregular Memory Access / Indirect Indexing (Gather)",
                "summary": "A[i] = B[indices[i]] * 1.5",
                "classification": "Partly vectorizable",
            },
            {
                "id": 5,
                "name": "Scalar Accumulation / Reduction",
                "summary": "total += A[i]",
                "classification": "Partly vectorizable",
            },
            {
                "id": 6,
                "name": "Read-Only 1D Stencil (Neighbor Smoothing)",
                "summary": "B[i] = 0.5 * (A[i-1] + A[i+1])",
                "classification": "Vectorizable",
            },
        ]

    def analyze_loop(self, loop_id: int, n: int = None) -> LoopAnalysisResult:
        """Executes and analyzes a specific loop by its ID (1 to 6)."""
        if n is None:
            n = self.n

        import time

        if loop_id == 1:
            # Loop 1: Independent element-wise addition/multiplication
            B = np.linspace(1.0, 10.0, n, dtype=np.float64)
            C = np.linspace(0.5, 5.0, n, dtype=np.float64)

            # Scalar
            t0 = time.perf_counter()
            A_scalar = np.zeros(n, dtype=np.float64)
            for i in range(n):
                A_scalar[i] = 2.5 * B[i] + C[i]
            t_scalar = (time.perf_counter() - t0) * 1000.0

            # NumPy (Vectorized)
            t0 = time.perf_counter()
            A_vector = 2.5 * B + C
            t_vector = (time.perf_counter() - t0) * 1000.0

            match = bool(np.allclose(A_scalar, A_vector))
            return LoopAnalysisResult(
                loop_id=1,
                name="Independent Element-Wise SAXPY",
                code_snippet="for i in range(n):\n    A[i] = 2.5 * B[i] + C[i]",
                classification="Vectorizable",
                reason="Independent iterations with uniform contiguous memory access. Iteration i does not depend on iteration j.",
                architectural_bottleneck="None. High throughput with SIMD FMA (Fused Multiply-Add) instructions across all vector lanes.",
                results_match=match,
                scalar_sample=A_scalar[:5].tolist(),
                vector_sample=A_vector[:5].tolist(),
                scalar_time_ms=t_scalar,
                vector_time_ms=t_vector,
            )

        elif loop_id == 2:
            # Loop 2: Loop-carried dependency
            B = np.linspace(1.0, 5.0, n, dtype=np.float64)
            initial_val = 10.0

            # Scalar
            t0 = time.perf_counter()
            A_scalar = np.zeros(n, dtype=np.float64)
            A_scalar[0] = initial_val
            for i in range(1, n):
                A_scalar[i] = A_scalar[i - 1] + B[i]
            t_scalar = (time.perf_counter() - t0) * 1000.0

            # NumPy (Vectorized equivalent using prefix sum / cumsum)
            t0 = time.perf_counter()
            A_vector = np.empty(n, dtype=np.float64)
            A_vector[0] = initial_val
            A_vector[1:] = initial_val + np.cumsum(B[1:])
            t_vector = (time.perf_counter() - t0) * 1000.0

            match = bool(np.allclose(A_scalar, A_vector))
            return LoopAnalysisResult(
                loop_id=2,
                name="Loop-Carried Dependency (Recurrence / Prefix Sum)",
                code_snippet="A[0] = initial\nfor i in range(1, n):\n    A[i] = A[i-1] + B[i]",
                classification="Not vectorizable",
                reason="True RAW (Read-After-Write) loop-carried dependency: iteration i strictly requires the result computed by iteration i-1.",
                architectural_bottleneck="Serial data dependency chain forces vector lanes to wait. Standard SIMD lockstep execution stalls; requires algorithmic rework (parallel prefix tree / Blelloch scan).",
                results_match=match,
                scalar_sample=A_scalar[:5].tolist(),
                vector_sample=A_vector[:5].tolist(),
                scalar_time_ms=t_scalar,
                vector_time_ms=t_vector,
            )

        elif loop_id == 3:
            # Loop 3: Conditional Branching
            np.random.seed(42)
            A_in = np.random.uniform(-5.0, 5.0, n).astype(np.float64)

            # Scalar
            t0 = time.perf_counter()
            A_scalar = A_in.copy()
            for i in range(n):
                if A_scalar[i] > 0.0:
                    A_scalar[i] = A_scalar[i] * 2.0
                else:
                    A_scalar[i] = -A_scalar[i]
            t_scalar = (time.perf_counter() - t0) * 1000.0

            # NumPy (Vectorized using masking / np.where)
            t0 = time.perf_counter()
            A_vector = np.where(A_in > 0.0, A_in * 2.0, -A_in)
            t_vector = (time.perf_counter() - t0) * 1000.0

            match = bool(np.allclose(A_scalar, A_vector))
            return LoopAnalysisResult(
                loop_id=3,
                name="Conditional Branching / Data-Dependent Threshold",
                code_snippet="for i in range(n):\n    if A[i] > 0:\n        A[i] = A[i] * 2.0\n    else:\n        A[i] = -A[i]",
                classification="Partly vectorizable",
                reason="Branch needs masking / predication. Control divergence means SIMD hardware evaluates both paths with lane write-masks.",
                architectural_bottleneck="Divergent control flow. Inactive lanes are masked off, wasting arithmetic potential. SIMD efficiency is capped by the union of execution paths.",
                results_match=match,
                scalar_sample=A_scalar[:5].tolist(),
                vector_sample=A_vector[:5].tolist(),
                scalar_time_ms=t_scalar,
                vector_time_ms=t_vector,
            )

        elif loop_id == 4:
            # Loop 4: Irregular Memory Access / Indirect Indexing
            np.random.seed(100)
            B = np.linspace(10.0, 100.0, n, dtype=np.float64)
            # Random non-contiguous permutation of indices
            indices = np.random.permutation(n)

            # Scalar
            t0 = time.perf_counter()
            A_scalar = np.zeros(n, dtype=np.float64)
            for i in range(n):
                A_scalar[i] = B[indices[i]] * 1.5
            t_scalar = (time.perf_counter() - t0) * 1000.0

            # NumPy (Fancy indexing / Gather)
            t0 = time.perf_counter()
            A_vector = B[indices] * 1.5
            t_vector = (time.perf_counter() - t0) * 1000.0

            match = bool(np.allclose(A_scalar, A_vector))
            return LoopAnalysisResult(
                loop_id=4,
                name="Irregular Memory Access / Indirect Indexing (Gather)",
                code_snippet="for i in range(n):\n    A[i] = B[indices[i]] * 1.5",
                classification="Partly vectorizable",
                reason="Irregular memory access pattern. Requires hardware Vector Gather instructions instead of contiguous streaming loads.",
                architectural_bottleneck="Non-unit stride memory access causes L1/L2 cache line underutilization and memory bank conflicts, degrading SIMD memory throughput.",
                results_match=match,
                scalar_sample=A_scalar[:5].tolist(),
                vector_sample=A_vector[:5].tolist(),
                scalar_time_ms=t_scalar,
                vector_time_ms=t_vector,
            )

        elif loop_id == 5:
            # Loop 5: Scalar Accumulation / Reduction
            A = np.linspace(1.0, 20.0, n, dtype=np.float64)

            # Scalar
            t0 = time.perf_counter()
            total_scalar = 0.0
            for i in range(n):
                total_scalar += A[i]
            t_scalar = (time.perf_counter() - t0) * 1000.0

            # NumPy (Vectorized reduction)
            t0 = time.perf_counter()
            total_vector = float(np.sum(A))
            t_vector = (time.perf_counter() - t0) * 1000.0

            match = bool(np.isclose(total_scalar, total_vector))
            return LoopAnalysisResult(
                loop_id=5,
                name="Scalar Accumulation / Reduction",
                code_snippet="total = 0.0\nfor i in range(n):\n    total += A[i]",
                classification="Partly vectorizable",
                reason="Single scalar accumulator creates a serial dependency. Requires horizontal vector reduction tree (pairwise addition) plus scalar post-processing.",
                architectural_bottleneck="Lanes can compute partial sums in parallel, but final reduction requires log2(L) horizontal operations, breaking uniform SIMD throughput.",
                results_match=match,
                scalar_sample=[total_scalar],
                vector_sample=[total_vector],
                scalar_time_ms=t_scalar,
                vector_time_ms=t_vector,
            )

        elif loop_id == 6:
            # Loop 6: Read-Only 1D Stencil
            A = np.linspace(2.0, 50.0, n, dtype=np.float64)

            # Scalar
            t0 = time.perf_counter()
            B_scalar = np.zeros(n, dtype=np.float64)
            for i in range(1, n - 1):
                B_scalar[i] = 0.5 * (A[i - 1] + A[i + 1])
            t_scalar = (time.perf_counter() - t0) * 1000.0

            # NumPy (Slicing / Vectorized stencil)
            t0 = time.perf_counter()
            B_vector = np.zeros(n, dtype=np.float64)
            B_vector[1:-1] = 0.5 * (A[:-2] + A[2:])
            t_vector = (time.perf_counter() - t0) * 1000.0

            match = bool(np.allclose(B_scalar, B_vector))
            return LoopAnalysisResult(
                loop_id=6,
                name="Read-Only 1D Stencil (Neighbor Smoothing)",
                code_snippet="for i in range(1, n-1):\n    B[i] = 0.5 * (A[i-1] + A[i+1])",
                classification="Vectorizable",
                reason="Independent iterations across target array B. Reads neighboring elements of A without write hazards (no loop-carried RAW dependency on B).",
                architectural_bottleneck="Requires unaligned vector loads or vector register shift operations. In Array Processors, requires inter-PE communication network.",
                results_match=match,
                scalar_sample=B_scalar[1:6].tolist(),
                vector_sample=B_vector[1:6].tolist(),
                scalar_time_ms=t_scalar,
                vector_time_ms=t_vector,
            )

        else:
            raise ValueError(f"Invalid loop_id: {loop_id}. Must be between 1 and 6.")


if __name__ == "__main__":
    analyzer = VectorizabilityAnalyzer(n=16)
    print("=" * 70)
    print("SIMD EXPLORER - MODULE 1: VECTORIZABILITY ANALYZER")
    print("=" * 70)
    for loop in analyzer.get_all_loops():
        res = analyzer.analyze_loop(loop["id"])
        print(f"\n[Loop {res.loop_id}] {res.name}")
        print(f"Code:\n{res.code_snippet}")
        print(f"Classification: {res.classification.upper()}")
        print(f"Reason: {res.reason}")
        print(f"Architectural Bottleneck: {res.architectural_bottleneck}")
        print(f"Results Match (Scalar == Vector): {res.results_match}")
