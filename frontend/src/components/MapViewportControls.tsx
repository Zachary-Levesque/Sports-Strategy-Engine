interface MapViewportControlsProps {
  zoomLabel: string;
  panEnabled?: boolean;
  onTogglePan?: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onReset: () => void;
}

export function MapViewportControls({
  zoomLabel,
  panEnabled = false,
  onTogglePan,
  onZoomIn,
  onZoomOut,
  onFit,
  onReset,
}: MapViewportControlsProps) {
  return (
    <div className="map-controls">
      {onTogglePan ? (
        <button
          type="button"
          className={`map-control-button ${panEnabled ? "map-control-button--active" : ""}`}
          onClick={onTogglePan}
        >
          Pan
        </button>
      ) : null}
      <button type="button" className="map-control-button" onClick={onZoomOut}>
        Zoom out
      </button>
      <button type="button" className="map-control-button" onClick={onZoomIn}>
        Zoom in
      </button>
      <button type="button" className="map-control-button" onClick={onFit}>
        Fit to screen
      </button>
      <button type="button" className="map-control-button" onClick={onReset}>
        Reset view
      </button>
      <span className="map-controls__zoom">{zoomLabel}</span>
    </div>
  );
}
