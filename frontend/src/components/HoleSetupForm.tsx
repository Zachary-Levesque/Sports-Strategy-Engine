import { useEffect, useState } from "react";

import type { HoleLayoutShape, HolePayload } from "../types";
import { HOLE_LAYOUT_OPTIONS, createGeneratedHoleDraft, suggestHoleId } from "../lib/holeEditor";

interface HoleSetupFormProps {
  hole: HolePayload;
  isEditing: boolean;
  shape: HoleLayoutShape;
  onGenerate: (hole: HolePayload) => void;
  onShapeChange: (shape: HoleLayoutShape) => void;
  onUpdateMeta: (hole: HolePayload) => void;
}

export function HoleSetupForm({
  hole,
  isEditing,
  shape,
  onGenerate,
  onShapeChange,
  onUpdateMeta,
}: HoleSetupFormProps) {
  const [setup, setSetup] = useState({
    hole_id: hole.hole_id,
    name: hole.name,
    par: hole.par as 3 | 4 | 5,
    yardage: hole.yardage,
  });

  useEffect(() => {
    setSetup({
      hole_id: hole.hole_id,
      name: hole.name,
      par: hole.par as 3 | 4 | 5,
      yardage: hole.yardage,
    });
  }, [hole.hole_id, hole.name, hole.par, hole.yardage]);

  function update<K extends keyof typeof setup>(key: K, value: (typeof setup)[K]) {
    setSetup((current) => ({ ...current, [key]: value }));
  }

  return (
    <section className="card">
      <div className="card__header">
        <div>
          <p className="eyebrow">Setup</p>
          <h2>{isEditing ? "Hole Metadata" : "Generate a New Hole"}</h2>
        </div>
      </div>
      <div className="form-grid">
        <label className="field">
          <span className="field__label">Hole Name</span>
          <input
            className="field__control"
            value={setup.name}
            onChange={(event) => {
              const name = event.target.value;
              update("name", name);
              if (!setup.hole_id || setup.hole_id === suggestHoleId(setup.name, setup.par, setup.yardage)) {
                update("hole_id", suggestHoleId(name, setup.par, setup.yardage));
              }
            }}
          />
        </label>
        <label className="field">
          <span className="field__label">Hole ID</span>
          <input
            className="field__control"
            value={setup.hole_id}
            onChange={(event) => update("hole_id", event.target.value)}
          />
        </label>
        <label className="field">
          <span className="field__label">Par</span>
          <select
            className="field__control"
            value={setup.par}
            onChange={(event) => update("par", Number(event.target.value) as 3 | 4 | 5)}
          >
            {[3, 4, 5].map((par) => (
              <option key={par} value={par}>
                {par}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">Length / Yardage</span>
          <input
            className="field__control"
            type="number"
            min={90}
            max={700}
            value={setup.yardage}
            onChange={(event) => update("yardage", Number(event.target.value))}
          />
        </label>
        <label className="field">
          <span className="field__label">Shape</span>
          <select
            className="field__control"
            value={shape}
            onChange={(event) => onShapeChange(event.target.value as HoleLayoutShape)}
          >
            {HOLE_LAYOUT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="helper-callout">
        <strong>Generation logic</strong>
        <span>
          The generator uses par, length, and shape to build the fairway bend, landing zones, hazards, and green placement before you start editing.
        </span>
      </div>
      <div className="action-row">
        <button
          className="primary-button primary-button--inline"
          type="button"
          onClick={() =>
            onGenerate(
              createGeneratedHoleDraft({
                hole_id: setup.hole_id,
                name: setup.name,
                par: setup.par,
                yardage: setup.yardage,
                shape,
              }),
            )
          }
        >
          {isEditing ? "Regenerate Layout" : "Generate Layout"}
        </button>
        <button
          className="secondary-button"
          type="button"
          onClick={() =>
            onUpdateMeta({
              ...hole,
              hole_id: setup.hole_id,
              name: setup.name,
              par: setup.par,
              yardage: setup.yardage,
            })
          }
        >
          Apply Metadata
        </button>
      </div>
    </section>
  );
}
