import type { HazardKind } from "../types";

export type HoleEditorTool = "select" | "add-bunker" | "add-water" | "add-ob" | "add-recovery";

interface HoleEditorToolbarProps {
  activeTool: HoleEditorTool;
  selectedHazardIndex: number | null;
  onToolChange: (tool: HoleEditorTool) => void;
  onDeleteSelected: () => void;
}

const TOOL_LABELS: Array<{ tool: HoleEditorTool; label: string }> = [
  { tool: "select", label: "Select" },
  { tool: "add-bunker", label: "Add bunker" },
  { tool: "add-water", label: "Add water" },
  { tool: "add-ob", label: "Add OB" },
  { tool: "add-recovery", label: "Add recovery" },
];

export function toolToHazardKind(tool: HoleEditorTool): HazardKind | null {
  if (tool === "add-bunker") {
    return "bunker";
  }
  if (tool === "add-water") {
    return "water";
  }
  if (tool === "add-ob") {
    return "ob";
  }
  if (tool === "add-recovery") {
    return "recovery";
  }
  return null;
}

export function HoleEditorToolbar({
  activeTool,
  selectedHazardIndex,
  onToolChange,
  onDeleteSelected,
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
    </div>
  );
}
