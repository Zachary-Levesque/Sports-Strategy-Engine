import type { HazardKind } from "../types";

export type HoleEditorTool =
  | "select"
  | "pan"
  | "resize"
  | "delete"
  | "place-fairway"
  | "place-green"
  | "place-rough"
  | "place-bunker"
  | "place-water"
  | "place-ob"
  | "place-recovery"
  | "place-pin"
  | "place-tee";

interface HoleEditorToolbarProps {
  activeTool: HoleEditorTool;
  selectedHazardIndex: number | null;
  onToolChange: (tool: HoleEditorTool) => void;
  onDeleteSelected: () => void;
  onFitToScreen: () => void;
}

const TOOL_LABELS: Array<{ tool: HoleEditorTool; label: string }> = [
  { tool: "select", label: "Select / Drag" },
  { tool: "resize", label: "Resize" },
  { tool: "pan", label: "Pan" },
  { tool: "delete", label: "Delete mode" },
  { tool: "place-fairway", label: "Fairway" },
  { tool: "place-green", label: "Green" },
  { tool: "place-rough", label: "Rough" },
  { tool: "place-bunker", label: "Bunker" },
  { tool: "place-water", label: "Water" },
  { tool: "place-ob", label: "OB" },
  { tool: "place-recovery", label: "Recovery" },
  { tool: "place-pin", label: "Pin" },
  { tool: "place-tee", label: "Tee" },
];

export function toolToHazardKind(tool: HoleEditorTool): HazardKind | null {
  if (tool === "place-bunker") {
    return "bunker";
  }
  if (tool === "place-water") {
    return "water";
  }
  if (tool === "place-ob") {
    return "ob";
  }
  if (tool === "place-recovery") {
    return "recovery";
  }
  return null;
}

export function HoleEditorToolbar({
  activeTool,
  selectedHazardIndex,
  onToolChange,
  onDeleteSelected,
  onFitToScreen,
}: HoleEditorToolbarProps) {
  return (
    <div className="editor-toolbar">
      {TOOL_LABELS.map((item) => (
        <button
          key={item.tool}
          type="button"
          className={`tab-button ${activeTool === item.tool ? "tab-button--active" : ""}`}
          onClick={() => onToolChange(item.tool)}
        >
          {item.label}
        </button>
      ))}
      <button
        type="button"
        className="danger-button"
        onClick={onDeleteSelected}
        disabled={selectedHazardIndex == null}
      >
        Delete selected
      </button>
      <button
        type="button"
        className="secondary-button"
        onClick={onFitToScreen}
      >
        Fit to screen
      </button>
    </div>
  );
}
