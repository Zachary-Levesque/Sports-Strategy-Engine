interface EditableCourseFeatureProps {
  x: number;
  y: number;
  label: string;
  selected?: boolean;
  onPointerDown?: (pointerId: number) => void;
}

export function EditableCourseFeature({
  x,
  y,
  label,
  selected = false,
  onPointerDown,
}: EditableCourseFeatureProps) {
  return (
    <g>
      <circle
        cx={x}
        cy={y}
        r={selected ? 9 : 7}
        className={`editor-handle ${selected ? "editor-handle--selected" : ""}`}
        onPointerDown={(event) => {
          event.stopPropagation();
          onPointerDown?.(event.pointerId);
        }}
      />
      <text x={x + 10} y={y - 10} className="editor-handle__label">
        {label}
      </text>
    </g>
  );
}
