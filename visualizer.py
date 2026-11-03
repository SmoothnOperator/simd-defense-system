"""
Module 4: Speedup Graph (figures)
Generates publication-quality Matplotlib figures for the presentation:
  1. Speedup vs Vector Length (demonstrates startup cost amortisation & strip-mining sawtooth)
  2. Amdahl's Law (Speedup vs Vectorizable Fraction for various acceleration factors)
"""

from typing import Tuple, Optional
import numpy as np
import matplotlib
# Use Agg backend by default for headless environments, but allow display if interactive
try:
    import matplotlib.pyplot as plt
except Exception:
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt


class SpeedupVisualizer:
    """Renders and saves comparative performance and Amdahl's law graphs."""

    def __init__(self, style_theme: str = "seaborn-v0_8-whitegrid"):
        try:
            plt.style.use(style_theme)
        except Exception:
            try:
                plt.style.use("default")
            except Exception:
                pass

    def generate_speedup_vs_length_figure(
        self,
        max_n: int = 256,
        vector_reg_len: int = 64,
        vector_startup: int = 12,
        scalar_cpe: int = 5,
        pe_count: int = 8,
        array_cycles_per_step: int = 3,
    ) -> matplotlib.figure.Figure:
        """
        Creates plot showing Speedup vs Vector Length (n).
        Highlights pipeline fill startup amortisation and strip-mining boundary steps.
        """
        n_vals = np.arange(1, max_n + 1)
        scalar_cycles = scalar_cpe * n_vals

        # Vector cycles with strip mining: ceil(n / MVL) * startup + n
        chunks = np.ceil(n_vals / vector_reg_len)
        vector_cycles = chunks * vector_startup + n_vals
        speedup_vector = scalar_cycles / vector_cycles

        # Array processor: ceil(n / pe_count) * array_cycles_per_step
        array_steps = np.ceil(n_vals / pe_count)
        array_cycles = array_steps * array_cycles_per_step
        speedup_array = scalar_cycles / array_cycles

        fig, ax = plt.subplots(figsize=(10, 5.5), dpi=120)

        ax.plot(
            n_vals,
            speedup_vector,
            label=f"Vector Processor (Startup={vector_startup}c, MVL={vector_reg_len})",
            color="#1E88E5",
            linewidth=2.5,
        )
        ax.plot(
            n_vals,
            speedup_array,
            label=f"Array Processor ({pe_count} PEs, {array_cycles_per_step}c/step)",
            color="#D81B60",
            linewidth=2.2,
            linestyle="--",
        )
        ax.axhline(
            1.0,
            color="#757575",
            linestyle=":",
            linewidth=1.8,
            label="Scalar Baseline (1.0x)",
        )

        # Mark key transition points
        ax.scatter([1], [speedup_vector[0]], color="#E53935", s=60, zorder=5)
        ax.annotate(
            f"n=1: {speedup_vector[0]:.2f}x\n(Scalar wins due to startup)",
            xy=(1, speedup_vector[0]),
            xytext=(15, 0.4),
            arrowprops=dict(facecolor="#E53935", shrink=0.08, width=1, headwidth=6),
            fontsize=9,
            fontweight="bold",
            color="#B71C1C",
        )

        # Annotate strip-mining boundary at MVL=64
        if max_n >= 64:
            ax.axvline(64, color="#1E88E5", linestyle=":", alpha=0.5)
            ax.annotate(
                "Strip-mining\nBoundary (n=64)",
                xy=(64, speedup_vector[63]),
                xytext=(72, speedup_vector[63] - 1.2),
                arrowprops=dict(facecolor="#1E88E5", shrink=0.08, width=1, headwidth=5),
                fontsize=8.5,
                color="#0D47A1",
            )

        ax.set_title(
            "SIMD Explorer: Speedup vs Vector Length (Startup Cost Amortisation)",
            fontsize=13,
            fontweight="bold",
            pad=12,
        )
        ax.set_xlabel("Vector Length (n elements)", fontsize=11, fontweight="bold")
        ax.set_ylabel("Speedup over Scalar (Cycles_Scalar / Cycles_SIMD)", fontsize=11, fontweight="bold")
        ax.set_xlim(0, max_n + 5)
        ax.set_ylim(0, max(np.max(speedup_array), np.max(speedup_vector)) * 1.15)
        ax.grid(True, linestyle="--", alpha=0.6)
        ax.legend(loc="lower right", frameon=True, fontsize=10)

        plt.tight_layout()
        return fig

    def generate_amdahl_figure(self) -> matplotlib.figure.Figure:
        """
        Creates plot of Amdahl's Law: Speedup vs Vectorizable Fraction (f)
        for various acceleration factors (P = 4, 8, 16, 64, inf).
        """
        f = np.linspace(0.0, 0.99, 500)
        p_factors = [4, 8, 16, 64]
        colors = ["#43A047", "#00ACC1", "#FB8C00", "#8E24AA"]

        fig, ax = plt.subplots(figsize=(10, 5.5), dpi=120)

        for p, col in zip(p_factors, colors):
            speedup = 1.0 / ((1.0 - f) + (f / p))
            ax.plot(f * 100, speedup, label=f"P = {p}x Vector Speedup", color=col, linewidth=2.0)

        # Theoretical Infinite Speedup (P -> inf): S = 1 / (1 - f)
        speedup_inf = 1.0 / (1.0 - f)
        ax.plot(
            f * 100,
            speedup_inf,
            label="P = ∞ (Theoretical Limit: 1 / (1-f))",
            color="#D81B60",
            linewidth=2.5,
            linestyle="--",
        )

        # Annotate 90% vectorizable bottleneck
        f_point = 0.90
        s_inf_90 = 1.0 / (1.0 - f_point)
        ax.scatter([90], [s_inf_90], color="#D81B60", s=60, zorder=5)
        ax.annotate(
            "At f = 90%, Max Speedup = 10x\n(Scalar 10% dominates!)",
            xy=(90, s_inf_90),
            xytext=(50, 16),
            arrowprops=dict(facecolor="#D81B60", shrink=0.08, width=1.2, headwidth=6),
            fontsize=9.5,
            fontweight="bold",
            color="#880E4F",
        )

        ax.set_title(
            "Amdahl's Law: Speedup vs Vectorizable Fraction (f)",
            fontsize=13,
            fontweight="bold",
            pad=12,
        )
        ax.set_xlabel("Vectorizable Fraction f (%)", fontsize=11, fontweight="bold")
        ax.set_ylabel("Overall Speedup S(f)", fontsize=11, fontweight="bold")
        ax.set_xlim(0, 100)
        ax.set_ylim(0, 25)
        ax.grid(True, linestyle="--", alpha=0.6)
        ax.legend(loc="upper left", frameon=True, fontsize=10)

        plt.tight_layout()
        return fig

    def generate_combined_figures(self, save_path: str = "simd_speedup_graphs.png") -> str:
        """Generates both plots side-by-side in a single 2-panel figure and saves to disk."""
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 6), dpi=120)

        # Panel 1: Speedup vs n
        max_n = 200
        n_vals = np.arange(1, max_n + 1)
        scalar_cycles = 5 * n_vals
        vector_cycles = np.ceil(n_vals / 64) * 12 + n_vals
        speedup_vector = scalar_cycles / vector_cycles

        array_steps = np.ceil(n_vals / 8)
        array_cycles = array_steps * 3
        speedup_array = scalar_cycles / array_cycles

        ax1.plot(n_vals, speedup_vector, label="Vector Processor (Startup=12c, MVL=64)", color="#1E88E5", linewidth=2.5)
        ax1.plot(n_vals, speedup_array, label="Array Processor (8 PEs, 3c/step)", color="#D81B60", linewidth=2.2, linestyle="--")
        ax1.axhline(1.0, color="#757575", linestyle=":", linewidth=1.5, label="Scalar Baseline (1.0x)")
        ax1.set_title("Panel A: Startup Cost Amortisation (Speedup vs n)", fontsize=12, fontweight="bold")
        ax1.set_xlabel("Vector Length (n)", fontsize=10, fontweight="bold")
        ax1.set_ylabel("Speedup over Scalar", fontsize=10, fontweight="bold")
        ax1.grid(True, linestyle="--", alpha=0.6)
        ax1.legend(loc="lower right", fontsize=9)

        # Panel 2: Amdahl's Law
        f = np.linspace(0.0, 0.98, 400)
        p_factors = [4, 8, 16, 64]
        colors = ["#43A047", "#00ACC1", "#FB8C00", "#8E24AA"]
        for p, col in zip(p_factors, colors):
            speedup = 1.0 / ((1.0 - f) + (f / p))
            ax2.plot(f * 100, speedup, label=f"P = {p}x", color=col, linewidth=1.8)

        speedup_inf = 1.0 / (1.0 - f)
        ax2.plot(f * 100, speedup_inf, label="P = ∞ (Amdahl Limit)", color="#D81B60", linewidth=2.2, linestyle="--")
        ax2.set_title("Panel B: Amdahl's Law (Speedup vs Vectorizable %)", fontsize=12, fontweight="bold")
        ax2.set_xlabel("Vectorizable Fraction f (%)", fontsize=10, fontweight="bold")
        ax2.set_ylabel("Overall Speedup S(f)", fontsize=10, fontweight="bold")
        ax2.set_ylim(0, 22)
        ax2.grid(True, linestyle="--", alpha=0.6)
        ax2.legend(loc="upper left", fontsize=9)

        plt.suptitle("SIMD Explorer - Performance Analysis Figures (Module 4)", fontsize=14, fontweight="bold", y=1.02)
        plt.tight_layout()
        plt.savefig(save_path, bbox_inches="tight")
        plt.close(fig)
        return save_path


if __name__ == "__main__":
    visualizer = SpeedupVisualizer()
    saved_file = visualizer.generate_combined_figures("simd_speedup_graphs.png")
    print(f"Generated and saved combined figure: {saved_file}")
