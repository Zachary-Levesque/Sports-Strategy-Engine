from __future__ import annotations

import os
from pathlib import Path

MPL_CONFIG_DIR = Path(__file__).resolve().parent.parent / "results" / ".mplconfig"
MPL_CONFIG_DIR.mkdir(parents=True, exist_ok=True)
os.environ.setdefault("MPLCONFIGDIR", str(MPL_CONFIG_DIR))

import matplotlib.pyplot as plt
from matplotlib.patches import Circle, Rectangle
import numpy as np

from hole_generator import Hole
from monte_carlo import SimulationResult


SURFACE_COLORS = {
    "fairway": "#86b875",
    "rough": "#5f8f4f",
    "green": "#b7e081",
    "bunker": "#dfc58d",
    "water": "#5ea7c5",
    "ob": "#d97d7d",
    "recovery": "#6a7d4f",
}


def plot_hole_layout(hole: Hole, result: SimulationResult, output_path: str | Path) -> Path:
    fig, ax = plt.subplots(figsize=(8, 10))
    fairway = Rectangle(
        (hole.fairway_center_x - hole.fairway_width / 2, hole.fairway_start_y),
        hole.fairway_width,
        hole.fairway_end_y - hole.fairway_start_y,
        color=SURFACE_COLORS["fairway"],
        alpha=0.85,
        label="Fairway",
    )
    rough = Rectangle(
        (hole.fairway_center_x - (hole.fairway_width / 2 + hole.rough_width), hole.fairway_start_y),
        hole.fairway_width + hole.rough_width * 2,
        hole.fairway_end_y - hole.fairway_start_y,
        color=SURFACE_COLORS["rough"],
        alpha=0.35,
        label="Rough",
    )
    green = Circle((hole.green_center.x, hole.green_center.y), hole.green_radius, color=SURFACE_COLORS["green"], alpha=0.9)
    tee = Circle((hole.tee.x, hole.tee.y), 6, color="#2d4739", label="Tee")

    ax.add_patch(rough)
    ax.add_patch(fairway)
    ax.add_patch(green)
    ax.add_patch(tee)

    for hazard in hole.hazards:
        color = SURFACE_COLORS.get(hazard.kind, "#999999")
        if hazard.shape == "circle" and hazard.radius is not None:
            ax.add_patch(Circle((hazard.center_x, hazard.center_y), hazard.radius, color=color, alpha=0.8))
        elif hazard.shape == "rectangle" and hazard.width is not None and hazard.depth is not None:
            ax.add_patch(
                Rectangle(
                    (hazard.center_x - hazard.width / 2, hazard.center_y - hazard.depth / 2),
                    hazard.width,
                    hazard.depth,
                    color=color,
                    alpha=0.8,
                )
            )
        elif hazard.shape == "corridor" and hazard.width is not None and hazard.start_y is not None and hazard.end_y is not None:
            ax.add_patch(
                Rectangle(
                    (hazard.center_x - hazard.width / 2, hazard.start_y),
                    hazard.width,
                    hazard.end_y - hazard.start_y,
                    color=color,
                    alpha=0.3,
                )
            )

    xs = np.array([sample.x for sample in result.samples])
    ys = np.array([sample.y for sample in result.samples])
    ax.scatter(xs, ys, c="#1b3f73", alpha=0.25, s=18, label="Shot cloud")
    ax.plot([hole.tee.x, result.option.aim_x], [hole.tee.y, result.option.aim_y], color="#1a1a1a", linewidth=2.0, label="Recommended line")
    ax.scatter([result.option.aim_x], [result.option.aim_y], c="#d81e5b", s=90, marker="x", label="Aim point")

    ax.set_title(f"{hole.name}: {result.option.club} / {result.option.shot_shape} / {int(result.option.swing_intensity * 100)}%")
    ax.set_xlabel("Lateral yards")
    ax.set_ylabel("Downrange yards")
    ax.set_xlim(-80, 80)
    ax.set_ylim(-10, hole.yardage + 40)
    ax.legend(loc="upper right")
    ax.grid(alpha=0.15)

    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    fig.tight_layout()
    fig.savefig(output, dpi=160)
    plt.close(fig)
    return output
