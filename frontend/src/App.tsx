import { useEffect, useMemo, useState } from "react";

import {
  createHole,
  createPlayer,
  deleteHole,
  deletePlayer,
  getHealth,
  getHole,
  getHoles,
  getPlayer,
  getPlayers,
  getRecommendation,
  getRecommendationHistory,
  getScenarios,
  updateHole,
  updatePlayer,
} from "./api/client";
import { AlternativesTable } from "./components/AlternativesTable";
import { HoleSelector } from "./components/HoleSelector";
import { PlayerSelector } from "./components/PlayerSelector";
import { ProbabilityBreakdown } from "./components/ProbabilityBreakdown";
import { RecommendationCard } from "./components/RecommendationCard";
import type {
  ClubData,
  HazardData,
  HolePayload,
  HoleSummary,
  PlayerPayload,
  PlayerSummary,
  RecommendationHistoryItem,
  RecommendationResponse,
  RiskTolerance,
  ScenarioSummary,
  ShotShape,
} from "./types";

type View = "strategy" | "players" | "holes" | "history";

const riskOptions: RiskTolerance[] = ["low", "medium", "high"];
const shapeOptions: ShotShape[] = ["straight", "draw", "fade"];
const handednessOptions = ["right", "left"] as const;
const missOptions = ["center", "none", "left", "right", "pull", "push"] as const;
const parOptions = [3, 4, 5] as const;

function emptyClub(): ClubData {
  return {
    club: "7-Iron",
    carry_yards: 150,
    total_yards: 158,
    lateral_sigma: 10,
    distance_sigma: 8,
    confidence: 0.8,
    shape_bias: 0,
    lie_adjustment_sensitivity: 0.08,
  };
}

function emptyHazard(): HazardData {
  return {
    kind: "bunker",
    shape: "circle",
    center_x: 0,
    center_y: 250,
    radius: 10,
    penalty_strokes: 0,
  };
}

function emptyPlayer(): PlayerPayload {
  return {
    player_name: "",
    handicap: 10,
    handedness: "right",
    preferred_shape: "straight",
    miss_tendency: "center",
    risk_tolerance: "medium",
    clubs: [emptyClub()],
  };
}

function emptyHole(): HolePayload {
  return {
    hole_id: "",
    name: "",
    par: 4,
    yardage: 400,
    tee: { x: 0, y: 0 },
    green_center: { x: 0, y: 400 },
    green_radius: 18,
    fairway_center_x: 0,
    fairway_width: 34,
    fairway_start_y: 40,
    fairway_end_y: 380,
    rough_width: 18,
    hazards: [emptyHazard()],
    wind: { speed_mph: 8, direction_deg: 45 },
  };
}

function App() {
  const [view, setView] = useState<View>("strategy");
  const [healthStatus, setHealthStatus] = useState("Checking backend...");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [players, setPlayers] = useState<PlayerSummary[]>([]);
  const [holes, setHoles] = useState<HoleSummary[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [history, setHistory] = useState<RecommendationHistoryItem[]>([]);

  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [selectedHole, setSelectedHole] = useState("");
  const [selectedScenario, setSelectedScenario] = useState("");
  const [iterations, setIterations] = useState(2000);
  const [riskTolerance, setRiskTolerance] = useState<RiskTolerance>("medium");
  const [result, setResult] = useState<RecommendationResponse | null>(null);

  const [playerForm, setPlayerForm] = useState<PlayerPayload>(emptyPlayer());
  const [editingPlayerName, setEditingPlayerName] = useState<string | null>(null);

  const [holeForm, setHoleForm] = useState<HolePayload>(emptyHole());
  const [editingHoleId, setEditingHoleId] = useState<string | null>(null);

  useEffect(() => {
    void loadInitialData();
  }, []);

  async function loadInitialData() {
    try {
      setLoading(true);
      setError("");
      const [health, playerData, holeData, scenarioData, historyData] = await Promise.all([
        getHealth(),
        getPlayers(),
        getHoles(),
        getScenarios(),
        getRecommendationHistory(),
      ]);
      setHealthStatus(health.status === "ok" ? "Backend online" : "Backend unavailable");
      setPlayers(playerData);
      setHoles(holeData);
      setScenarios(scenarioData);
      setHistory(historyData);

      if (playerData.length > 0) {
        setSelectedPlayer((current) => current || playerData[0].player_name);
        setRiskTolerance((current) => current || playerData[0].risk_tolerance);
      }
      if (holeData.length > 0) {
        setSelectedHole((current) => current || holeData[0].hole_id);
      }
      if (scenarioData.length > 0) {
        setSelectedScenario((current) => current || scenarioData[0].name);
      }
    } catch (loadError) {
      setHealthStatus("Backend unreachable");
      setError(loadError instanceof Error ? loadError.message : "Failed to load application data.");
    } finally {
      setLoading(false);
    }
  }

  const activePlayer = useMemo(
    () => players.find((player) => player.player_name === selectedPlayer) ?? null,
    [players, selectedPlayer],
  );
  const activeHole = useMemo(
    () => holes.find((hole) => hole.hole_id === selectedHole) ?? null,
    [holes, selectedHole],
  );

  useEffect(() => {
    if (activePlayer) {
      setRiskTolerance(activePlayer.risk_tolerance);
    }
  }, [activePlayer]);

  async function loadPlayerIntoForm(playerName: string) {
    const detail = await getPlayer(playerName);
    setPlayerForm({
      player_name: detail.player_name,
      handicap: detail.handicap,
      handedness: detail.handedness,
      preferred_shape: detail.preferred_shape,
      miss_tendency: detail.miss_tendency,
      risk_tolerance: detail.risk_tolerance,
      clubs: detail.clubs.map(({ id: _id, ...club }) => club),
    });
    setEditingPlayerName(playerName);
    setView("players");
  }

  async function loadHoleIntoForm(holeId: string) {
    const detail = await getHole(holeId);
    setHoleForm({
      hole_id: detail.hole_id,
      name: detail.name,
      par: detail.par,
      yardage: detail.yardage,
      tee: detail.tee,
      green_center: detail.green_center,
      green_radius: detail.green_radius,
      fairway_center_x: detail.fairway_center_x,
      fairway_width: detail.fairway_width,
      fairway_start_y: detail.fairway_start_y,
      fairway_end_y: detail.fairway_end_y,
      rough_width: detail.rough_width,
      hazards: detail.hazards,
      wind: detail.wind,
    });
    setEditingHoleId(holeId);
    setView("holes");
  }

  function applyScenario(name: string) {
    setSelectedScenario(name);
    const scenario = scenarios.find((item) => item.name === name);
    if (!scenario) {
      return;
    }
    setSelectedPlayer(scenario.player_name);
    setSelectedHole(scenario.hole_id);
    setIterations(scenario.iterations);
    if (scenario.risk_tolerance_override) {
      setRiskTolerance(scenario.risk_tolerance_override);
    }
  }

  async function runRecommendation() {
    if (!selectedPlayer || !selectedHole) {
      return;
    }
    try {
      setSubmitting(true);
      setError("");
      const recommendation = await getRecommendation({
        player_name: selectedPlayer,
        hole_id: selectedHole,
        iterations,
        risk_tolerance_override: riskTolerance,
      });
      setResult(recommendation);
      setHistory(await getRecommendationHistory());
      setView("strategy");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to fetch recommendation.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitPlayerForm() {
    try {
      setSaving(true);
      setError("");
      if (editingPlayerName) {
        await updatePlayer(editingPlayerName, playerForm);
      } else {
        await createPlayer(playerForm);
      }
      await loadInitialData();
      setEditingPlayerName(playerForm.player_name);
      setSelectedPlayer(playerForm.player_name);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to save player.");
    } finally {
      setSaving(false);
    }
  }

  async function submitHoleForm() {
    try {
      setSaving(true);
      setError("");
      if (editingHoleId) {
        await updateHole(editingHoleId, holeForm);
      } else {
        await createHole(holeForm);
      }
      await loadInitialData();
      setEditingHoleId(holeForm.hole_id);
      setSelectedHole(holeForm.hole_id);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to save hole.");
    } finally {
      setSaving(false);
    }
  }

  async function removeCurrentPlayer() {
    if (!editingPlayerName) {
      return;
    }
    try {
      setSaving(true);
      await deletePlayer(editingPlayerName);
      setPlayerForm(emptyPlayer());
      setEditingPlayerName(null);
      await loadInitialData();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete player.");
    } finally {
      setSaving(false);
    }
  }

  async function removeCurrentHole() {
    if (!editingHoleId) {
      return;
    }
    try {
      setSaving(true);
      await deleteHole(editingHoleId);
      setHoleForm(emptyHole());
      setEditingHoleId(null);
      await loadInitialData();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete hole.");
    } finally {
      setSaving(false);
    }
  }

  function updateClub(index: number, key: keyof ClubData, value: string) {
    setPlayerForm((current) => {
      const clubs = [...current.clubs];
      clubs[index] = {
        ...clubs[index],
        [key]: key === "club" ? value : Number(value),
      };
      return { ...current, clubs };
    });
  }

  function updateHazard(index: number, key: keyof HazardData, value: string) {
    setHoleForm((current) => {
      const hazards = [...current.hazards];
      hazards[index] = {
        ...hazards[index],
        [key]:
          key === "kind" || key === "shape"
            ? value
            : value === ""
              ? null
              : Number(value),
      };
      return { ...current, hazards };
    });
  }

  function renderStrategyView() {
    return (
      <div className="layout">
        <section className="control-panel card">
          <div className="card__header">
            <div>
              <p className="eyebrow">Workflow</p>
              <h2>Run Recommendation</h2>
            </div>
          </div>

          {loading ? (
            <div className="state-message">Loading player, hole, scenario, and history data...</div>
          ) : (
            <>
              {scenarios.length > 0 ? (
                <label className="field">
                  <span className="field__label">Scenario</span>
                  <select
                    className="field__control"
                    value={selectedScenario}
                    onChange={(event) => applyScenario(event.target.value)}
                  >
                    {scenarios.map((scenario) => (
                      <option key={scenario.name} value={scenario.name}>
                        {scenario.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <PlayerSelector players={players} value={selectedPlayer} onChange={setSelectedPlayer} />
              <HoleSelector holes={holes} value={selectedHole} onChange={setSelectedHole} />

              <label className="field">
                <span className="field__label">Iterations</span>
                <input
                  className="field__control"
                  type="number"
                  min={100}
                  max={50000}
                  step={100}
                  value={iterations}
                  onChange={(event) => setIterations(Number(event.target.value))}
                />
              </label>

              <label className="field">
                <span className="field__label">Risk Tolerance</span>
                <select
                  className="field__control"
                  value={riskTolerance}
                  onChange={(event) => setRiskTolerance(event.target.value as RiskTolerance)}
                >
                  {riskOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <button className="primary-button" type="button" onClick={() => void runRecommendation()} disabled={submitting}>
                {submitting ? "Running Simulation..." : "Run Recommendation"}
              </button>
            </>
          )}

          {activePlayer ? (
            <div className="summary-block">
              <h3>Selected Player</h3>
              <p>
                {activePlayer.player_name} prefers a {activePlayer.preferred_shape}, misses {activePlayer.miss_tendency},
                and uses {activePlayer.club_count} stored clubs.
              </p>
              <button className="secondary-button" type="button" onClick={() => void loadPlayerIntoForm(activePlayer.player_name)}>
                Edit Player
              </button>
            </div>
          ) : null}

          {activeHole ? (
            <div className="summary-block">
              <h3>Selected Hole</h3>
              <p>
                {activeHole.name} is a par {activeHole.par} measuring {activeHole.yardage} yards with wind at{" "}
                {activeHole.wind_speed_mph} mph from {activeHole.wind_direction_deg} degrees.
              </p>
              <button className="secondary-button" type="button" onClick={() => void loadHoleIntoForm(activeHole.hole_id)}>
                Edit Hole
              </button>
            </div>
          ) : null}
        </section>

        <section className="results-panel">
          {error ? <div className="error-banner">{error}</div> : null}
          {result ? (
            <div className="results-stack">
              <RecommendationCard result={result} />
              <ProbabilityBreakdown probabilities={result.probabilities} />
              <AlternativesTable alternatives={result.top_alternatives} />
            </div>
          ) : (
            <section className="card empty-state">
              <p className="eyebrow">Awaiting Simulation</p>
              <h2>No recommendation yet</h2>
              <p>Choose a player and hole, then run the engine to compare strategies and inspect the recommendation breakdown.</p>
            </section>
          )}
        </section>
      </div>
    );
  }

  function renderPlayersView() {
    return (
      <div className="editor-layout">
        <section className="card sidebar-card">
          <div className="card__header">
            <div>
              <p className="eyebrow">Profiles</p>
              <h2>Players</h2>
            </div>
            <button className="secondary-button" type="button" onClick={() => { setPlayerForm(emptyPlayer()); setEditingPlayerName(null); }}>
              New
            </button>
          </div>
          <div className="list-stack">
            {players.map((player) => (
              <button key={player.player_name} className="list-card" type="button" onClick={() => void loadPlayerIntoForm(player.player_name)}>
                <strong>{player.player_name}</strong>
                <span>HCP {player.handicap} · {player.preferred_shape} · {player.club_count} clubs</span>
              </button>
            ))}
          </div>
        </section>

        <section className="card form-card">
          <div className="card__header">
            <div>
              <p className="eyebrow">Editor</p>
              <h2>{editingPlayerName ? `Edit ${editingPlayerName}` : "Create Player"}</h2>
            </div>
          </div>
          <div className="form-grid">
            <label className="field"><span className="field__label">Player Name</span><input className="field__control" value={playerForm.player_name} onChange={(e) => setPlayerForm({ ...playerForm, player_name: e.target.value })} /></label>
            <label className="field"><span className="field__label">Handicap</span><input className="field__control" type="number" value={playerForm.handicap} onChange={(e) => setPlayerForm({ ...playerForm, handicap: Number(e.target.value) })} /></label>
            <label className="field"><span className="field__label">Handedness</span><select className="field__control" value={playerForm.handedness} onChange={(e) => setPlayerForm({ ...playerForm, handedness: e.target.value as PlayerPayload["handedness"] })}>{handednessOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            <label className="field"><span className="field__label">Preferred Shape</span><select className="field__control" value={playerForm.preferred_shape} onChange={(e) => setPlayerForm({ ...playerForm, preferred_shape: e.target.value as ShotShape })}>{shapeOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            <label className="field"><span className="field__label">Miss Tendency</span><select className="field__control" value={playerForm.miss_tendency} onChange={(e) => setPlayerForm({ ...playerForm, miss_tendency: e.target.value as PlayerPayload["miss_tendency"] })}>{missOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            <label className="field"><span className="field__label">Risk Tolerance</span><select className="field__control" value={playerForm.risk_tolerance} onChange={(e) => setPlayerForm({ ...playerForm, risk_tolerance: e.target.value as RiskTolerance })}>{riskOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          </div>
          <div className="section-divider">
            <div className="card__header">
              <div>
                <p className="eyebrow">Distances</p>
                <h3>Club Table</h3>
              </div>
              <button className="secondary-button" type="button" onClick={() => setPlayerForm({ ...playerForm, clubs: [...playerForm.clubs, emptyClub()] })}>
                Add Club
              </button>
            </div>
            <div className="table-wrap">
              <table className="alternatives-table">
                <thead>
                  <tr><th>Club</th><th>Carry</th><th>Total</th><th>Lat Sigma</th><th>Dist Sigma</th><th>Confidence</th><th /></tr>
                </thead>
                <tbody>
                  {playerForm.clubs.map((club, index) => (
                    <tr key={`${club.club}-${index}`}>
                      <td><input className="table-input" value={club.club} onChange={(e) => updateClub(index, "club", e.target.value)} /></td>
                      <td><input className="table-input" type="number" value={club.carry_yards} onChange={(e) => updateClub(index, "carry_yards", e.target.value)} /></td>
                      <td><input className="table-input" type="number" value={club.total_yards} onChange={(e) => updateClub(index, "total_yards", e.target.value)} /></td>
                      <td><input className="table-input" type="number" value={club.lateral_sigma} onChange={(e) => updateClub(index, "lateral_sigma", e.target.value)} /></td>
                      <td><input className="table-input" type="number" value={club.distance_sigma} onChange={(e) => updateClub(index, "distance_sigma", e.target.value)} /></td>
                      <td><input className="table-input" type="number" step="0.01" value={club.confidence} onChange={(e) => updateClub(index, "confidence", e.target.value)} /></td>
                      <td><button className="danger-link" type="button" onClick={() => setPlayerForm({ ...playerForm, clubs: playerForm.clubs.filter((_, row) => row !== index) })}>Remove</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="action-row">
            <button className="primary-button primary-button--inline" type="button" onClick={() => void submitPlayerForm()} disabled={saving}>
              {saving ? "Saving..." : editingPlayerName ? "Update Player" : "Create Player"}
            </button>
            {editingPlayerName ? <button className="danger-button" type="button" onClick={() => void removeCurrentPlayer()} disabled={saving}>Delete Player</button> : null}
          </div>
        </section>
      </div>
    );
  }

  function renderHolesView() {
    return (
      <div className="editor-layout">
        <section className="card sidebar-card">
          <div className="card__header">
            <div><p className="eyebrow">Course Data</p><h2>Holes</h2></div>
            <button className="secondary-button" type="button" onClick={() => { setHoleForm(emptyHole()); setEditingHoleId(null); }}>
              New
            </button>
          </div>
          <div className="list-stack">
            {holes.map((hole) => (
              <button key={hole.hole_id} className="list-card" type="button" onClick={() => void loadHoleIntoForm(hole.hole_id)}>
                <strong>{hole.name}</strong>
                <span>{hole.hole_id} · Par {hole.par} · {hole.yardage}y</span>
              </button>
            ))}
          </div>
        </section>

        <section className="card form-card">
          <div className="card__header">
            <div><p className="eyebrow">Editor</p><h2>{editingHoleId ? `Edit ${editingHoleId}` : "Create Hole"}</h2></div>
          </div>
          <div className="form-grid">
            <label className="field"><span className="field__label">Hole ID</span><input className="field__control" value={holeForm.hole_id} onChange={(e) => setHoleForm({ ...holeForm, hole_id: e.target.value })} /></label>
            <label className="field"><span className="field__label">Name</span><input className="field__control" value={holeForm.name} onChange={(e) => setHoleForm({ ...holeForm, name: e.target.value })} /></label>
            <label className="field"><span className="field__label">Par</span><select className="field__control" value={holeForm.par} onChange={(e) => setHoleForm({ ...holeForm, par: Number(e.target.value) as HolePayload["par"] })}>{parOptions.map((par) => <option key={par} value={par}>{par}</option>)}</select></label>
            <label className="field"><span className="field__label">Yardage</span><input className="field__control" type="number" value={holeForm.yardage} onChange={(e) => setHoleForm({ ...holeForm, yardage: Number(e.target.value) })} /></label>
            <label className="field"><span className="field__label">Fairway Width</span><input className="field__control" type="number" value={holeForm.fairway_width} onChange={(e) => setHoleForm({ ...holeForm, fairway_width: Number(e.target.value) })} /></label>
            <label className="field"><span className="field__label">Wind MPH</span><input className="field__control" type="number" value={holeForm.wind.speed_mph} onChange={(e) => setHoleForm({ ...holeForm, wind: { ...holeForm.wind, speed_mph: Number(e.target.value) } })} /></label>
            <label className="field"><span className="field__label">Wind Direction</span><input className="field__control" type="number" value={holeForm.wind.direction_deg} onChange={(e) => setHoleForm({ ...holeForm, wind: { ...holeForm.wind, direction_deg: Number(e.target.value) } })} /></label>
            <label className="field"><span className="field__label">Green Center Y</span><input className="field__control" type="number" value={holeForm.green_center.y} onChange={(e) => setHoleForm({ ...holeForm, green_center: { ...holeForm.green_center, y: Number(e.target.value) } })} /></label>
          </div>

          <div className="section-divider">
            <div className="card__header">
              <div><p className="eyebrow">Hazards</p><h3>Hazard Editor</h3></div>
              <button className="secondary-button" type="button" onClick={() => setHoleForm({ ...holeForm, hazards: [...holeForm.hazards, emptyHazard()] })}>
                Add Hazard
              </button>
            </div>
            <div className="table-wrap">
              <table className="alternatives-table">
                <thead>
                  <tr><th>Kind</th><th>Shape</th><th>Center X</th><th>Center Y</th><th>Radius</th><th>Width</th><th>Depth</th><th /></tr>
                </thead>
                <tbody>
                  {holeForm.hazards.map((hazard, index) => (
                    <tr key={`${hazard.kind}-${index}`}>
                      <td><input className="table-input" value={hazard.kind} onChange={(e) => updateHazard(index, "kind", e.target.value)} /></td>
                      <td><input className="table-input" value={hazard.shape} onChange={(e) => updateHazard(index, "shape", e.target.value)} /></td>
                      <td><input className="table-input" type="number" value={hazard.center_x} onChange={(e) => updateHazard(index, "center_x", e.target.value)} /></td>
                      <td><input className="table-input" type="number" value={hazard.center_y} onChange={(e) => updateHazard(index, "center_y", e.target.value)} /></td>
                      <td><input className="table-input" type="number" value={hazard.radius ?? ""} onChange={(e) => updateHazard(index, "radius", e.target.value)} /></td>
                      <td><input className="table-input" type="number" value={hazard.width ?? ""} onChange={(e) => updateHazard(index, "width", e.target.value)} /></td>
                      <td><input className="table-input" type="number" value={hazard.depth ?? ""} onChange={(e) => updateHazard(index, "depth", e.target.value)} /></td>
                      <td><button className="danger-link" type="button" onClick={() => setHoleForm({ ...holeForm, hazards: holeForm.hazards.filter((_, row) => row !== index) })}>Remove</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="action-row">
            <button className="primary-button primary-button--inline" type="button" onClick={() => void submitHoleForm()} disabled={saving}>
              {saving ? "Saving..." : editingHoleId ? "Update Hole" : "Create Hole"}
            </button>
            {editingHoleId ? <button className="danger-button" type="button" onClick={() => void removeCurrentHole()} disabled={saving}>Delete Hole</button> : null}
          </div>
        </section>
      </div>
    );
  }

  function renderHistoryView() {
    return (
      <section className="card">
        <div className="card__header">
          <div><p className="eyebrow">Persistence</p><h2>Recommendation History</h2></div>
          <button className="secondary-button" type="button" onClick={() => void loadInitialData()}>
            Refresh
          </button>
        </div>
        {history.length === 0 ? (
          <p className="empty-copy">Run a recommendation to start building saved history.</p>
        ) : (
          <div className="history-grid">
            {history.map((item) => (
              <article key={item.recommendation_id} className="history-card">
                <div className="history-card__header">
                  <div>
                    <strong>{item.best_strategy.club}</strong>
                    <span>{item.player_name} · {item.hole_id}</span>
                  </div>
                  <span className="pill">#{item.recommendation_id}</span>
                </div>
                <p className="history-card__meta">
                  {new Date(item.created_at).toLocaleString()} · Expected {item.expected_strokes.toFixed(2)} · Risk {item.risk_adjusted_score.toFixed(2)}
                </p>
                <p>{item.explanation}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="hero__kicker">Persistent full-stack golf decision engine</p>
          <h1>Sports Strategy Engine</h1>
          <p className="hero__subtitle">
            Manage player profiles and holes, run recommendations, and review saved strategy history from the local FastAPI and SQLite stack.
          </p>
        </div>
        <div className={`status ${healthStatus === "Backend online" ? "status--ok" : "status--warn"}`}>{healthStatus}</div>
      </header>

      <nav className="tab-row">
        {[
          ["strategy", "Strategy"],
          ["players", "Players"],
          ["holes", "Holes"],
          ["history", "History"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`tab-button ${view === key ? "tab-button--active" : ""}`}
            onClick={() => setView(key as View)}
          >
            {label}
          </button>
        ))}
      </nav>

      {error ? <div className="error-banner">{error}</div> : null}

      {view === "strategy" ? renderStrategyView() : null}
      {view === "players" ? renderPlayersView() : null}
      {view === "holes" ? renderHolesView() : null}
      {view === "history" ? renderHistoryView() : null}
    </div>
  );
}

export default App;
