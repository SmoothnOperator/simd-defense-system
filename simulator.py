"""
Module 2: Vector vs Array vs Scalar Simulator (compare, worked example, and demo)
Simulates element-wise vector addition (C = A + B) and 1D Stencil (B[i] = A[i-1] + A[i+1])
across three classic computing paradigms:
  1. Scalar Processor (sequential ALU, 1 element at a time)
  2. Vector Processor (pipelined vector registers, strip-mining)
  3. Array Processor (grid of parallel Processing Elements in lockstep SIMD)

Highlights the architectural difference: Vector processors amortize startup via deep
pipelining; Array processors suffer from inter-PE communication latency during stencils.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Tuple
import math
import numpy as np


@dataclass
class StripMiningChunk:
    chunk_index: int
    start_idx: int
    end_idx: int
    length: int
    cycles: int
    reg_v0_sample: List[float]
    reg_v1_sample: List[float]
    reg_v2_sample: List[float]


@dataclass
class PEStepState:
    step_index: int
    pe_id: int
    element_index: int
    is_active: bool
    val_a: float
    val_b: float
    val_c: float
    comm_note: str = ""


@dataclass
class SimulationResult:
    problem_type: str  # 'vector_add' or 'stencil'
    n: int
    scalar_cycles: int
    vector_cycles: int
    array_cycles: int
    scalar_model_desc: str
    vector_model_desc: str
    array_model_desc: str
    strip_chunks: List[StripMiningChunk]
    pe_grid_steps: List[List[PEStepState]]
    speedup_vector_vs_scalar: float
    speedup_array_vs_scalar: float
    speedup_array_vs_vector: float
    architectural_insight: str


class SIMDSimulator:
    """Simulates Scalar, Vector, and Array processors on vector addition and stencils."""

    def __init__(
        self,
        vector_reg_length: int = 64,
        vector_startup_cycles: int = 12,
        scalar_cycles_per_element: int = 5,
        array_pe_count: int = 8,
        array_broadcast_cycles: int = 2,
        array_alu_cycles: int = 1,
        array_comm_cycles_per_hop: int = 3,
    ):
        self.MVL = vector_reg_length  # Maximum Vector Length (e.g. Cray-1 = 64)
        self.vector_startup = vector_startup_cycles
        self.scalar_cpe = scalar_cycles_per_element
        self.pe_count = array_pe_count
        self.array_bcast = array_broadcast_cycles
        self.array_alu = array_alu_cycles
        self.array_comm = array_comm_cycles_per_hop

    def simulate_vector_add(self, n: int = 64) -> SimulationResult:
        """Simulates C = A + B for n elements across Scalar, Vector, and Array."""
        A = np.arange(1, n + 1, dtype=np.float64)
        B = np.arange(101, 101 + n, dtype=np.float64)
        C = A + B

        # 1. SCALAR PROCESSOR
        # Model: ~5 cycles per element (Load A, Load B, Add, Store C, Loop increment/branch)
        scalar_cycles = self.scalar_cpe * n

        # 2. VECTOR PROCESSOR (Strip-mining)
        # Model: Startup S = 12 cycles + 1 cycle/element per chunk of size <= MVL
        strip_chunks: List[StripMiningChunk] = []
        curr = 0
        chunk_idx = 0
        total_vector_cycles = 0

        while curr < n:
            chunk_len = min(self.MVL, n - curr)
            chunk_start = curr
            chunk_end = curr + chunk_len
            chunk_cycles = self.vector_startup + chunk_len
            total_vector_cycles += chunk_cycles

            # Slice samples for vector register display
            v0_slice = A[chunk_start:chunk_end][:4].tolist()
            v1_slice = B[chunk_start:chunk_end][:4].tolist()
            v2_slice = C[chunk_start:chunk_end][:4].tolist()

            strip_chunks.append(
                StripMiningChunk(
                    chunk_index=chunk_idx,
                    start_idx=chunk_start,
                    end_idx=chunk_end,
                    length=chunk_len,
                    cycles=chunk_cycles,
                    reg_v0_sample=v0_slice,
                    reg_v1_sample=v1_slice,
                    reg_v2_sample=v2_slice,
                )
            )
            curr += chunk_len
            chunk_idx += 1

        # 3. ARRAY PROCESSOR (8 PEs in lockstep)
        # Model: ceil(n / PE_COUNT) lockstep steps.
        # Each step: CU broadcast (e.g. 2 cycles) + parallel ALU add (1 cycle) = 3 cycles.
        num_steps = math.ceil(n / self.pe_count)
        array_cycles_per_step = self.array_bcast + self.array_alu
        total_array_cycles = num_steps * array_cycles_per_step

        pe_grid_steps: List[List[PEStepState]] = []
        for step in range(num_steps):
            step_pes: List[PEStepState] = []
            for pe in range(self.pe_count):
                elem_idx = step * self.pe_count + pe
                if elem_idx < n:
                    step_pes.append(
                        PEStepState(
                            step_index=step,
                            pe_id=pe,
                            element_index=elem_idx,
                            is_active=True,
                            val_a=float(A[elem_idx]),
                            val_b=float(B[elem_idx]),
                            val_c=float(C[elem_idx]),
                            comm_note="No inter-PE comm needed (embarrassingly parallel)",
                        )
                    )
                else:
                    step_pes.append(
                        PEStepState(
                            step_index=step,
                            pe_id=pe,
                            element_index=-1,
                            is_active=False,
                            val_a=0.0,
                            val_b=0.0,
                            val_c=0.0,
                            comm_note="Masked off (lane idle)",
                        )
                    )
            pe_grid_steps.append(step_pes)

        insight = (
            f"For n={n}, Scalar takes {scalar_cycles} cycles ({self.scalar_cpe} cyc/elem). "
            f"Vector Processor uses {len(strip_chunks)} strip-mining chunk(s) taking {total_vector_cycles} cycles "
            f"({self.vector_startup} startup + 1 cyc/elem). "
            f"Array Processor takes {total_array_cycles} cycles ({num_steps} steps of {self.pe_count} PEs, "
            f"{self.array_bcast} broadcast + {self.array_alu} ALU = {array_cycles_per_step} cyc/step)."
        )

        return SimulationResult(
            problem_type="vector_add",
            n=n,
            scalar_cycles=scalar_cycles,
            vector_cycles=total_vector_cycles,
            array_cycles=total_array_cycles,
            scalar_model_desc=f"{self.scalar_cpe} cycles/element (load A, load B, add, store C, branch overhead)",
            vector_model_desc=f"{self.vector_startup} startup cycles + 1 cycle/element, strip-mined at MVL={self.MVL}",
            array_model_desc=f"{self.pe_count} PEs lockstep: {self.array_bcast} cyc broadcast + {self.array_alu} cyc ALU = {array_cycles_per_step} cyc/step",
            strip_chunks=strip_chunks,
            pe_grid_steps=pe_grid_steps,
            speedup_vector_vs_scalar=round(scalar_cycles / total_vector_cycles, 2),
            speedup_array_vs_scalar=round(scalar_cycles / total_array_cycles, 2),
            speedup_array_vs_vector=round(total_vector_cycles / total_array_cycles, 2),
            architectural_insight=insight,
        )

    def simulate_stencil(self, n: int = 64) -> SimulationResult:
        """
        Simulates 1D Stencil B[i] = A[i-1] + A[i+1] for n elements.
        Crucial architectural differentiator:
          - Vector Processor: Loads unaligned vectors or register shifts; pipeline flows smoothly.
          - Array Processor: Requires nearest-neighbor communication (Left/Right shifts across PEs).
        """
        A = np.arange(10, 10 + n, dtype=np.float64)
        B = np.zeros(n, dtype=np.float64)
        for i in range(1, n - 1):
            B[i] = A[i - 1] + A[i + 1]

        # 1. SCALAR PROCESSOR
        # 5 cycles/element (load A[i-1], load A[i+1], add, store B[i], loop branch)
        scalar_cycles = self.scalar_cpe * (n - 2)

        # 2. VECTOR PROCESSOR
        # Startup: 12 cycles + 2 cycles vector shift/align overhead + 1 cycle/element
        vector_stencil_startup = self.vector_startup + 2
        strip_chunks: List[StripMiningChunk] = []
        curr = 1
        num_stencil_elems = n - 2
        chunk_idx = 0
        total_vector_cycles = 0

        while curr < n - 1:
            chunk_len = min(self.MVL, (n - 1) - curr)
            chunk_start = curr
            chunk_end = curr + chunk_len
            chunk_cycles = vector_stencil_startup + chunk_len
            total_vector_cycles += chunk_cycles

            v0_slice = A[chunk_start - 1 : chunk_end - 1][:4].tolist()
            v1_slice = A[chunk_start + 1 : chunk_end + 1][:4].tolist()
            v2_slice = B[chunk_start:chunk_end][:4].tolist()

            strip_chunks.append(
                StripMiningChunk(
                    chunk_index=chunk_idx,
                    start_idx=chunk_start,
                    end_idx=chunk_end,
                    length=chunk_len,
                    cycles=chunk_cycles,
                    reg_v0_sample=v0_slice,
                    reg_v1_sample=v1_slice,
                    reg_v2_sample=v2_slice,
                )
            )
            curr += chunk_len
            chunk_idx += 1

        # 3. ARRAY PROCESSOR (Needs inter-PE communication network!)
        # In an 8-PE array processor, PE p computes element i.
        # But A[i-1] is held by PE p-1 and A[i+1] is held by PE p+1!
        # Step breakdown:
        #   - CU broadcast: 2 cycles
        #   - Interconnect shift left (receive from right neighbor PE): 3 cycles
        #   - Interconnect shift right (receive from left neighbor PE): 3 cycles
        #   - Parallel ALU Add: 1 cycle
        # Total per step = 2 + 3 + 3 + 1 = 9 cycles/step!
        array_stencil_step_cycles = self.array_bcast + (2 * self.array_comm) + self.array_alu
        num_steps = math.ceil(n / self.pe_count)
        total_array_cycles = num_steps * array_stencil_step_cycles

        pe_grid_steps: List[List[PEStepState]] = []
        for step in range(num_steps):
            step_pes: List[PEStepState] = []
            for pe in range(self.pe_count):
                elem_idx = step * self.pe_count + pe
                if 1 <= elem_idx < n - 1:
                    left_pe = (pe - 1) % self.pe_count
                    right_pe = (pe + 1) % self.pe_count
                    step_pes.append(
                        PEStepState(
                            step_index=step,
                            pe_id=pe,
                            element_index=elem_idx,
                            is_active=True,
                            val_a=float(A[elem_idx - 1]),
                            val_b=float(A[elem_idx + 1]),
                            val_c=float(B[elem_idx]),
                            comm_note=f"PE{pe} fetches A[{elem_idx-1}] from PE{left_pe} and A[{elem_idx+1}] from PE{right_pe} over network",
                        )
                    )
                else:
                    step_pes.append(
                        PEStepState(
                            step_index=step,
                            pe_id=pe,
                            element_index=elem_idx,
                            is_active=False,
                            val_a=0.0,
                            val_b=0.0,
                            val_c=0.0,
                            comm_note="Boundary element / masked off",
                        )
                    )
            pe_grid_steps.append(step_pes)

        insight = (
            f"STENCIL CASE DEMO: For n={n}, Scalar takes {scalar_cycles} cycles. "
            f"Vector Processor takes {total_vector_cycles} cycles via internal vector register shifts. "
            f"Array Processor cycles jump to {total_array_cycles} cycles ({num_steps} steps * {array_stencil_step_cycles} cyc/step) "
            f"because every PE step pays a {2 * self.array_comm}-cycle penalty for nearest-neighbor inter-PE network transfers! "
            f"This demonstrates why Array Processors require fast toroidal/mesh interconnects for stencils."
        )

        return SimulationResult(
            problem_type="stencil",
            n=n,
            scalar_cycles=scalar_cycles,
            vector_cycles=total_vector_cycles,
            array_cycles=total_array_cycles,
            scalar_model_desc=f"{self.scalar_cpe} cycles/element for {n-2} elements",
            vector_model_desc=f"{vector_stencil_startup} startup + 1 cyc/element (internal register shifting)",
            array_model_desc=f"{self.pe_count} PEs: {self.array_bcast} bcast + {2*self.array_comm} inter-PE network hops + {self.array_alu} ALU = {array_stencil_step_cycles} cyc/step",
            strip_chunks=strip_chunks,
            pe_grid_steps=pe_grid_steps,
            speedup_vector_vs_scalar=round(scalar_cycles / total_vector_cycles, 2),
            speedup_array_vs_scalar=round(scalar_cycles / total_array_cycles, 2),
            speedup_array_vs_vector=round(total_vector_cycles / total_array_cycles, 2),
            architectural_insight=insight,
        )


if __name__ == "__main__":
    sim = SIMDSimulator()

    print("=" * 70)
    print("MODULE 2: WORKED EXAMPLE 1 (C = A + B for n = 64)")
    print("=" * 70)
    res64 = sim.simulate_vector_add(n=64)
    print(f"Scalar Cycles:  {res64.scalar_cycles} (Model: {res64.scalar_model_desc})")
    print(f"Vector Cycles:  {res64.vector_cycles} (Model: {res64.vector_model_desc})")
    print(f"Array Cycles:   {res64.array_cycles} (Model: {res64.array_model_desc})")
    print(f"Speedup Vector vs Scalar: {res64.speedup_vector_vs_scalar}x")
    print(f"Speedup Array vs Scalar:  {res64.speedup_array_vs_scalar}x")
    print(f"\nStrip Mining Chunks for n=64: {len(res64.strip_chunks)} chunk(s)")
    for ch in res64.strip_chunks:
        print(f"  Chunk {ch.chunk_index}: [{ch.start_idx}:{ch.end_idx}] length={ch.length}, cycles={ch.cycles}")

    print("\n" + "=" * 70)
    print("MODULE 2: WORKED EXAMPLE 2 (Strip-Mining for n = 200)")
    print("=" * 70)
    res200 = sim.simulate_vector_add(n=200)
    print(f"Vector Cycles: {res200.vector_cycles} cycles")
    print("Strip Mining Breakdown for n=200 (MVL=64):")
    chunk_str = " + ".join([str(ch.length) for ch in res200.strip_chunks])
    print(f"  Chunks: {chunk_str} = {sum(ch.length for ch in res200.strip_chunks)}")
    for ch in res200.strip_chunks:
        print(f"  Chunk {ch.chunk_index}: length {ch.length} -> {ch.cycles} cycles (12 startup + {ch.length})")

    print("\n" + "=" * 70)
    print("MODULE 2: STENCIL CASE (B[i] = A[i-1] + A[i+1] for n = 64)")
    print("=" * 70)
    res_sten = sim.simulate_stencil(n=64)
    print(f"Scalar Cycles: {res_sten.scalar_cycles}")
    print(f"Vector Cycles: {res_sten.vector_cycles}")
    print(f"Array Cycles:  {res_sten.array_cycles}")
    print(f"Insight: {res_sten.architectural_insight}")
