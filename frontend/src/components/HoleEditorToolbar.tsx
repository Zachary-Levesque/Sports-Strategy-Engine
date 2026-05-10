import type { HazardKind } from "../types";

export type HoleEditorTool =
  | "select"
  | "pan"
  | "place-bunker"
  | "place-water"
  | "place-ob"
  | "place-recovery";

interface HoleEditorToolbarProps {
  activeTool: HoleEditorTool;
  canUndo: boolean;
  selectedHazardIndex: number | null;
  onToolChange: (tool: HoleEditorTool) => void;
  onUndoLast: () => void;
  onDeleteSelected: () => void;
  onFitToScreen: () => void;
}

const PRIMARY_TOOLS: Array<{ tool: HoleEditorTool; label: string }> = [
  { tool: "select", label: "Edit course" },
  { tool: "pan", label: "Pan view" },
];

const HAZARD_TOOLS: Array<{ tool: HoleEditorTool; label: string }> = [
  { tool: "place-bunker", label: "Add bunker" },
  { tool: "place-water", label: "Add water" },
  { tool: "place-ob", label: "Add OB" },
  { tool: "place-recovery", label: "Add recovery" },
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
  canUndo,
  selectedHazardIndex,
  onToolChange,
  onUndoLast,
  onDeleteSelected,
  onFitToScreen,
}: HoleEditorToolbarProps) {
  return (
    <div className="editor-toolbar">
      <div className="editor-toolbar__section">
        <span className="editor-toolbar__label">Mode</span>
        <div className="editor-toolbar__group">
          {PRIMARY_TOOLS.map((item) => (
            <button
              key={item.tool}
              type="button"
              className={`tab-button ${activeTool === item.tool ? "tab-button--active" : ""}`}
              onClick={() => onToolChange(item.tool)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="editor-toolbar__section">
        <span className="editor-toolbar__label">Add hazards</span>
        <div className="editor-toolbar__group">
          {HAZARD_TOOLS.map((item) => (
            <button
              key={item.tool}
              type="button"
              className={`tab-button ${activeTool === item.tool ? "tab-button--active" : ""}`}
              onClick={() => onToolChange(item.tool)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="editor-toolbar__section editor-toolbar__section--actions">
        <button type="button" className="secondary-button" onClick={onUndoLast} disabled={!canUndo}>
          Cancel last change
        </button>
        <button type="button" className="danger-button" onClick={onDeleteSelected} disabled={selectedHazardIndex == null}>
          Delete selected
        </button>
        <button type="button" className="secondary-button" onClick={onFitToScreen}>
          Fit to screen
        </button>
      </div>
    </div>
  );
}
