import type { HoleSummary } from "../types";

interface HoleSelectorProps {
  holes: HoleSummary[];
  value: string;
  onChange: (value: string) => void;
}

export function HoleSelector({ holes, value, onChange }: HoleSelectorProps) {
  return (
    <label className="field">
      <span className="field__label">Hole</span>
      <select
        className="field__control"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {holes.map((hole) => (
          <option key={hole.hole_id} value={hole.hole_id}>
            {hole.name} · Par {hole.par} · {hole.yardage}y
          </option>
        ))}
      </select>
    </label>
  );
}
