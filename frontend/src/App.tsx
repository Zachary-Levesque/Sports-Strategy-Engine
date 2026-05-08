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
import { HoleMap } from "./components/HoleMap";
import { HoleSelector } from "./components/HoleSelector";
import { PlayerSelector } from "./components/PlayerSelector";
import { ProbabilityBreakdown } from "./components/ProbabilityBreakdown";
import { RecommendationCard } from "./components/RecommendationCard";
import type {
  AimPoint,
  ClubData,
  HazardData,
  HoleDetail,
  HolePayload,
  HoleSummary,
  LieType,
  PlayerPayload,
  PlayerSummary,
  RecommendationHistoryItem,
  RecommendationResponse,
  RiskTolerance,
  ScenarioSummary,
  ShotMode,
  ShotShape,
} from "./types";

type View = "strategy" | "players" | "holes" | "history";

type ClubDraft = {
  rowId: string;
  club: string;
  carry_yards: string;
  total_yards: string;
  lateral_sigma: string;
  distance_sigma: string;
  confidence: string;
  shape_bias: string;
  lie_adjustment_sensitivity: string;
};

const riskOptions: RiskTolerance[] = ["low", "medium", "high"];
const shapeOptions: ShotShape[] = ["straight", "draw", "fade"];
const shotModeOptions: Array<{ value: ShotMode; label: string }> = [
  { value: "tee", label: "Tee shot" },
  { value: "custom", label: "Approach / custom shot" },
];
const lieOptions: LieType[] = ["tee", "fairway", "rough", "bunker", "recovery"];
const handednessOptions = ["right", "left"] as const;
const missOptions = ["center", "none", "left", "right", "pull", "push"] as const;
const parOptions = [3, 4, 5] as const;

let nextDraftId = 0;

function createDraftId(prefix: string): string {
  nextDraftId += 1;
  return `${prefix}-${nextDraftId}`;
}

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

function clubToDraft(club: ClubData): ClubDraft {
  return {
    rowId: createDraftId("club"),
    club: club.club,
    carry_yards: String(club.carry_yards),
    total_yards: String(club.total_yards),
    lateral_sigma: String(club.lateral_sigma),
    distance_sigma: String(club.distance_sigma),
    confidence: String(club.confidence),
    shape_bias: String(club.shape_bias),
    lie_adjustment_sensitivity: String(club.lie_adjustment_sensitivity),
  };
}

function parseDraftNumber(value: string): number {
  return value.trim() === "" ? 0 : Number(value);
}

function draftToClub(draft: ClubDraft): ClubData {
  return {
    club: draft.club.trim(),
    carry_yards: parseDraftNumber(draft.carry_yards),
    total_yards: parseDraftNumber(draft.total_yards),
    lateral_sigma: parseDraftNumber(draft.lateral_sigma),
    distance_sigma: parseDraftNumber(draft.distance_sigma),
    confidence: parseDraftNumber(draft.confidence),
    shape_bias: parseDraftNumber(draft.shape_bias),
    lie_adjustment_sensitivity: parseDraftNumber(draft.lie_adjustment_sensitivity),
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
  const [notice, setNotice] = useState("");

  const [players, setPlayers] = useState<PlayerSummary[]>([]);
  const [holes, setHoles] = useState<HoleSummary[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [history, setHistory] = useState<RecommendationHistoryItem[]>([]);

  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [selectedHole, setSelectedHole] = useState("");
  const [selectedScenario, setSelectedScenario] = useState("");
  const [iterations, setIterations] = useState(2000);
  const [riskTolerance, setRiskTolerance] = useState<RiskTolerance>("medium");
  const [shotMode, setShotMode] = useState<ShotMode>("tee");
  const [customLie, setCustomLie] = useState<LieType>("fairway");
  const [customBallPosition, setCustomBallPosition] = useState<AimPoint>({ x: 0, y: 0 });
  const [customTargetPosition, setCustomTargetPosition] = useState<AimPoint>({ x: 0, y: 0 });
  const [result, setResult] = useState<RecommendationResponse | null>(null);
  const [selectedHoleDetail, setSelectedHoleDetail] = useState<HoleDetail | null>(null);

  const [playerForm, setPlayerForm] = useState<PlayerPayload>(emptyPlayer());
  const [playerClubDrafts, setPlayerClubDrafts] = useState<ClubDraft[]>([clubToDraft(emptyClub())]);
  const [editingPlayerName, setEditingPlayerName] = useState<string | null>(null);

  const [holeForm, setHoleForm] = useState<HolePayload>(emptyHole());
  const [editingHoleId, setEditingHoleId] = useState<string | null>(null);

  useEffect(() => {
    void loadInitialData();
  }, []);

  useEffect(() => {
    if (!selectedHole) {
      setSelectedHoleDetail(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const detail = await getHole(selectedHole);
        if (cancelled) {
          return;
        }
        setSelectedHoleDetail(detail);
        setCustomBallPosition({ x: detail.tee.x, y: detail.tee.y });
        setCustomTargetPosition({ x: detail.green_center.x, y: detail.green_center.y });
      } catch {
        if (!cancelled) {
          setSelectedHoleDetail(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedHole]);

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
    const nextPayload = {
      player_name: detail.player_name,
      handicap: detail.handicap,
      handedness: detail.handedness,
      preferred_shape: detail.preferred_shape,
      miss_tendency: detail.miss_tendency,
      risk_tolerance: detail.risk_tolerance,
      clubs: detail.clubs.map(({ id: _id, ...club }) => club),
    };
    setPlayerForm(nextPayload);
    setPlayerClubDrafts(nextPayload.clubs.map(clubToDraft));
    setEditingPlayerName(playerName);
    setNotice("");
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
    setNotice("");
    setView("holes");
  }

  function resetPlayerForm() {
    const next = emptyPlayer();
    setPlayerForm(next);
    setPlayerClubDrafts(next.clubs.map(clubToDraft));
    setEditingPlayerName(null);
    setNotice("");
  }

  function resetHoleForm() {
    setHoleForm(emptyHole());
    setEditingHoleId(null);
    setNotice("");
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
    setShotMode("tee");
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
      setNotice("");
      const recommendation = await getRecommendation({
        player_name: selectedPlayer,
        hole_id: selectedHole,
        iterations,
        risk_tolerance_override: riskTolerance,
        shot_mode: shotMode,
        ball_position: shotMode === "custom" ? customBallPosition : undefined,
        lie: shotMode === "custom" ? customLie : undefined,
        target_position: shotMode === "custom" ? customTargetPosition : undefined,
      });
      setResult(recommendation);
      setHistory(await getRecommendationHistory());
      setView("strategy");
      setNotice("Recommendation saved to history.");
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
      const payload: PlayerPayload = {
        ...playerForm,
        clubs: playerClubDrafts.map(draftToClub),
      };
      if (editingPlayerName) {
        await updatePlayer(editingPlayerName, payload);
      } else {
        await createPlayer(payload);
      }
      setPlayerForm(payload);
      await loadInitialData();
      setEditingPlayerName(payload.player_name);
      setSelectedPlayer(payload.player_name);
      setNotice(`Saved player ${payload.player_name}.`);
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
      setNotice(`Saved hole ${holeForm.name || holeForm.hole_id}.`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to save hole.");
    } finally {
      setSaving(false);
    }
  }

  async function removeCurrentPlayer() {
    if (!editingPlayerName || !window.confirm(`Delete player ${editingPlayerName}?`)) {
      return;
    }
    try {
      setSaving(true);
      await deletePlayer(editingPlayerName);
      resetPlayerForm();
      await loadInitialData();
      setNotice(`Deleted player ${editingPlayerName}.`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete player.");
    } finally {
      setSaving(false);
    }
  }

  async function removeCurrentHole() {
    if (!editingHoleId || !window.confirm(`Delete hole ${editingHoleId}?`)) {
      return;
    }
    try {
      setSaving(true);
      await deleteHole(editingHoleId);
      resetHoleForm();
      await loadInitialData();
      setNotice(`Deleted hole ${editingHoleId}.`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete hole.");
    } finally {
      setSaving(false);
    }
  }

  function updatePlayerField<K extends keyof PlayerPayload>(key: K, value: PlayerPayload[K]) {
    setPlayerForm((current) => ({ ...current, [key]: value }));
  }

  function updateClubDraft(index: number, key: keyof ClubDraft, value: string) {
    setPlayerClubDrafts((current) =>
      current.map((club, rowIndex) => (rowIndex === index ? { ...club, [key]: value } : club)),
    );
  }

  function addClubDraft() {
    setPlayerClubDrafts((current) => [...current, clubToDraft(emptyClub())]);
  }

  function removeClubDraft(index: number) {
    setPlayerClubDrafts((current) => current.filter((_, row) => row !== index));
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

  function updateHoleField<K extends keyof HolePayload>(key: K, value: HolePayload[K]) {
    setHoleForm((current) => ({ ...current, [key]: value }));
  }

  function renderStrategyView() {
    const mapHole = selectedHoleDetail
      ? {
          hole_id: selectedHoleDetail.hole_id,
          name: selectedHoleDetail.name,
          par: selectedHoleDetail.par,
          yardage: selectedHoleDetail.yardage,
          tee: selectedHoleDetail.tee,
          green_center: selectedHoleDetail.green_center,
          green_radius: selectedHoleDetail.green_radius,
          fairway_center_x: selectedHoleDetail.fairway_center_x,
          fairway_width: selectedHoleDetail.fairway_width,
          fairway_start_y: selectedHoleDetail.fairway_start_y,
          fairway_end_y: selectedHoleDetail.fairway_end_y,
          rough_width: selectedHoleDetail.rough_width,
          hazards: selectedHoleDetail.hazards,
          wind: selectedHoleDetail.wind,
        }
      : null;

    return (
      <div className="layout">
        <section className="control-panel card">
          <div className="card__header">
            <div>
              <p className="eyebrow">Workflow</p>
              <h2>{shotMode === "tee" ? "Tee Shot Recommendation" : "Custom Shot Recommendation"}</h2>
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
                <span className="field__label">Shot mode</span>
                <select
                  className="field__control"
                  value={shotMode}
                  onChange={(event) => setShotMode(event.target.value as ShotMode)}
                >
                  {shotModeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span className="field__help">
                  Tee shot uses the hole tee. Custom shot starts from your selected ball position and lie.
                </span>
              </label>

              {shotMode === "custom" ? (
                <div className="form-grid form-grid--tight">
                  <label className="field">
                    <span className="field__label">Current lie</span>
                    <select
                      className="field__control"
                      value={customLie}
                      onChange={(event) => setCustomLie(event.target.value as LieType)}
                    >
                      {lieOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span className="field__label">Ball X</span>
                    <input
                      className="field__control"
                      type="number"
                      value={customBallPosition.x}
                      onChange={(event) =>
                        setCustomBallPosition((current) => ({ ...current, x: Number(event.target.value) }))
                      }
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">Ball Y</span>
                    <input
                      className="field__control"
                      type="number"
                      value={customBallPosition.y}
                      onChange={(event) =>
                        setCustomBallPosition((current) => ({ ...current, y: Number(event.target.value) }))
                      }
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">Target X</span>
                    <input
                      className="field__control"
                      type="number"
                      value={customTargetPosition.x}
                      onChange={(event) =>
                        setCustomTargetPosition((current) => ({ ...current, x: Number(event.target.value) }))
                      }
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">Target Y</span>
                    <input
                      className="field__control"
                      type="number"
                      value={customTargetPosition.y}
                      onChange={(event) =>
                        setCustomTargetPosition((current) => ({ ...current, y: Number(event.target.value) }))
                      }
                    />
                  </label>
                </div>
              ) : null}

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

              <button
                className="primary-button"
                type="button"
                onClick={() => void runRecommendation()}
                disabled={submitting}
              >
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
              <button
                className="secondary-button"
                type="button"
                onClick={() => void loadPlayerIntoForm(activePlayer.player_name)}
              >
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
              <button
                className="secondary-button"
                type="button"
                onClick={() => void loadHoleIntoForm(activeHole.hole_id)}
              >
                Edit Hole
              </button>
            </div>
          ) : null}
        </section>

        <section className="results-panel">
          {result ? (
            <div className="results-stack">
              <RecommendationCard result={result} />
              {mapHole ? (
                <HoleMap
                  hole={mapHole}
                  title="Shot map"
                  subtitle="Live course view with the recommended line and landing cloud."
                  startPosition={result.start_position}
                  targetPosition={result.target_position}
                  aimPoint={result.best_strategy.aim_point}
                  shotSamples={result.shot_samples}
                />
              ) : null}
              <ProbabilityBreakdown probabilities={result.probabilities} />
              <AlternativesTable alternatives={result.top_alternatives} />
            </div>
          ) : mapHole ? (
            <div className="results-stack">
              <HoleMap
                hole={mapHole}
                title="Hole preview"
                subtitle="Preview the live hole geometry before running the engine."
                startPosition={shotMode === "custom" ? customBallPosition : mapHole.tee}
                targetPosition={shotMode === "custom" ? customTargetPosition : mapHole.green_center}
              />
              <section className="card empty-state">
                <p className="eyebrow">Awaiting Simulation</p>
                <h2>No recommendation yet</h2>
                <p>Choose a player and hole, then run the engine to compare strategies and inspect the recommendation breakdown.</p>
              </section>
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
            <button className="secondary-button" type="button" onClick={resetPlayerForm}>
              New
            </button>
          </div>
          <div className="list-stack">
            {players.map((player) => (
              <button
                key={player.player_name}
                className="list-card"
                type="button"
                onClick={() => void loadPlayerIntoForm(player.player_name)}
              >
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
            <label className="field">
              <span className="field__label">Player Name</span>
              <input
                className="field__control"
                value={playerForm.player_name}
                onChange={(event) => updatePlayerField("player_name", event.target.value)}
              />
            </label>
            <label className="field">
              <span className="field__label">Handicap</span>
              <input
                className="field__control"
                type="number"
                value={playerForm.handicap}
                onChange={(event) => updatePlayerField("handicap", Number(event.target.value))}
              />
            </label>
            <label className="field">
              <span className="field__label">Handedness</span>
              <select
                className="field__control"
                value={playerForm.handedness}
                onChange={(event) =>
                  updatePlayerField("handedness", event.target.value as PlayerPayload["handedness"])
                }
              >
                {handednessOptions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Preferred Shape</span>
              <select
                className="field__control"
                value={playerForm.preferred_shape}
                onChange={(event) => updatePlayerField("preferred_shape", event.target.value as ShotShape)}
              >
                {shapeOptions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Miss Tendency</span>
              <select
                className="field__control"
                value={playerForm.miss_tendency}
                onChange={(event) =>
                  updatePlayerField("miss_tendency", event.target.value as PlayerPayload["miss_tendency"])
                }
              >
                {missOptions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field__label">Risk Tolerance</span>
              <select
                className="field__control"
                value={playerForm.risk_tolerance}
                onChange={(event) => updatePlayerField("risk_tolerance", event.target.value as RiskTolerance)}
              >
                {riskOptions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="section-divider">
            <div className="card__header">
              <div>
                <p className="eyebrow">Distances</p>
                <h3>Club Table</h3>
              </div>
              <button className="secondary-button" type="button" onClick={addClubDraft}>
                Add Club
              </button>
            </div>
            <div className="helper-callout">
              <strong>Distance dispersion</strong>
              <span>How much your shot distance usually varies. Higher number = less consistent distance.</span>
            </div>
            <div className="helper-callout">
              <strong>Left/right dispersion</strong>
              <span>How much your shot misses left or right. Higher number = wider shot pattern.</span>
            </div>
            <div className="table-wrap">
              <table className="alternatives-table">
                <thead>
                  <tr>
                    <th>Club</th>
                    <th>Carry</th>
                    <th>Total</th>
                    <th>Left/right dispersion</th>
                    <th>Distance dispersion</th>
                    <th>Confidence</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {playerClubDrafts.map((club, index) => (
                    <tr key={club.rowId}>
                      <td>
                        <input
                          className="table-input"
                          value={club.club}
                          onChange={(event) => updateClubDraft(index, "club", event.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="table-input"
                          type="number"
                          value={club.carry_yards}
                          onChange={(event) => updateClubDraft(index, "carry_yards", event.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="table-input"
                          type="number"
                          value={club.total_yards}
                          onChange={(event) => updateClubDraft(index, "total_yards", event.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="table-input"
                          type="number"
                          value={club.lateral_sigma}
                          onChange={(event) => updateClubDraft(index, "lateral_sigma", event.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="table-input"
                          type="number"
                          value={club.distance_sigma}
                          onChange={(event) => updateClubDraft(index, "distance_sigma", event.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="table-input"
                          type="number"
                          step="0.01"
                          value={club.confidence}
                          onChange={(event) => updateClubDraft(index, "confidence", event.target.value)}
                        />
                      </td>
                      <td>
                        <button className="danger-link" type="button" onClick={() => removeClubDraft(index)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="action-row">
            <button
              className="primary-button primary-button--inline"
              type="button"
              onClick={() => void submitPlayerForm()}
              disabled={saving}
            >
              {saving ? "Saving..." : editingPlayerName ? "Update Player" : "Create Player"}
            </button>
            {editingPlayerName ? (
              <button className="danger-button" type="button" onClick={() => void removeCurrentPlayer()} disabled={saving}>
                Delete Player
              </button>
            ) : null}
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
            <div>
              <p className="eyebrow">Course Data</p>
              <h2>Holes</h2>
            </div>
            <button className="secondary-button" type="button" onClick={resetHoleForm}>
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

        <section className="results-stack">
          <section className="card form-card">
            <div className="card__header">
              <div>
                <p className="eyebrow">Editor</p>
                <h2>{editingHoleId ? `Edit ${editingHoleId}` : "Create Hole"}</h2>
              </div>
            </div>
            <div className="form-grid">
              <label className="field"><span className="field__label">Hole ID</span><input className="field__control" value={holeForm.hole_id} onChange={(event) => updateHoleField("hole_id", event.target.value)} /></label>
              <label className="field"><span className="field__label">Name</span><input className="field__control" value={holeForm.name} onChange={(event) => updateHoleField("name", event.target.value)} /></label>
              <label className="field"><span className="field__label">Par</span><select className="field__control" value={holeForm.par} onChange={(event) => updateHoleField("par", Number(event.target.value) as HolePayload["par"])}>{parOptions.map((par) => <option key={par} value={par}>{par}</option>)}</select></label>
              <label className="field"><span className="field__label">Yardage</span><input className="field__control" type="number" value={holeForm.yardage} onChange={(event) => updateHoleField("yardage", Number(event.target.value))} /></label>
              <label className="field"><span className="field__label">Tee X</span><input className="field__control" type="number" value={holeForm.tee.x} onChange={(event) => updateHoleField("tee", { ...holeForm.tee, x: Number(event.target.value) })} /></label>
              <label className="field"><span className="field__label">Tee Y</span><input className="field__control" type="number" value={holeForm.tee.y} onChange={(event) => updateHoleField("tee", { ...holeForm.tee, y: Number(event.target.value) })} /></label>
              <label className="field"><span className="field__label">Green Center X</span><input className="field__control" type="number" value={holeForm.green_center.x} onChange={(event) => updateHoleField("green_center", { ...holeForm.green_center, x: Number(event.target.value) })} /></label>
              <label className="field"><span className="field__label">Green Center Y</span><input className="field__control" type="number" value={holeForm.green_center.y} onChange={(event) => updateHoleField("green_center", { ...holeForm.green_center, y: Number(event.target.value) })} /></label>
              <label className="field"><span className="field__label">Green Radius</span><input className="field__control" type="number" value={holeForm.green_radius} onChange={(event) => updateHoleField("green_radius", Number(event.target.value))} /></label>
              <label className="field"><span className="field__label">Fairway Center X</span><input className="field__control" type="number" value={holeForm.fairway_center_x} onChange={(event) => updateHoleField("fairway_center_x", Number(event.target.value))} /></label>
              <label className="field"><span className="field__label">Fairway Width</span><input className="field__control" type="number" value={holeForm.fairway_width} onChange={(event) => updateHoleField("fairway_width", Number(event.target.value))} /></label>
              <label className="field"><span className="field__label">Fairway Start Y</span><input className="field__control" type="number" value={holeForm.fairway_start_y} onChange={(event) => updateHoleField("fairway_start_y", Number(event.target.value))} /></label>
              <label className="field"><span className="field__label">Fairway End Y</span><input className="field__control" type="number" value={holeForm.fairway_end_y} onChange={(event) => updateHoleField("fairway_end_y", Number(event.target.value))} /></label>
              <label className="field"><span className="field__label">Rough Width</span><input className="field__control" type="number" value={holeForm.rough_width} onChange={(event) => updateHoleField("rough_width", Number(event.target.value))} /></label>
              <label className="field"><span className="field__label">Wind MPH</span><input className="field__control" type="number" value={holeForm.wind.speed_mph} onChange={(event) => updateHoleField("wind", { ...holeForm.wind, speed_mph: Number(event.target.value) })} /></label>
              <label className="field"><span className="field__label">Wind Direction</span><input className="field__control" type="number" value={holeForm.wind.direction_deg} onChange={(event) => updateHoleField("wind", { ...holeForm.wind, direction_deg: Number(event.target.value) })} /></label>
            </div>

            <div className="section-divider">
              <div className="card__header">
                <div><p className="eyebrow">Hazards</p><h3>Hazard Editor</h3></div>
                <button className="secondary-button" type="button" onClick={() => updateHoleField("hazards", [...holeForm.hazards, emptyHazard()])}>
                  Add Hazard
                </button>
              </div>
              <div className="table-wrap">
                <table className="alternatives-table">
                  <thead>
                    <tr><th>Kind</th><th>Shape</th><th>Center X</th><th>Center Y</th><th>Radius</th><th>Width</th><th>Depth</th><th>Penalty</th><th /></tr>
                  </thead>
                  <tbody>
                    {holeForm.hazards.map((hazard, index) => (
                      <tr key={`${hazard.kind}-${index}`}>
                        <td><input className="table-input" value={hazard.kind} onChange={(event) => updateHazard(index, "kind", event.target.value)} /></td>
                        <td><input className="table-input" value={hazard.shape} onChange={(event) => updateHazard(index, "shape", event.target.value)} /></td>
                        <td><input className="table-input" type="number" value={hazard.center_x} onChange={(event) => updateHazard(index, "center_x", event.target.value)} /></td>
                        <td><input className="table-input" type="number" value={hazard.center_y} onChange={(event) => updateHazard(index, "center_y", event.target.value)} /></td>
                        <td><input className="table-input" type="number" value={hazard.radius ?? ""} onChange={(event) => updateHazard(index, "radius", event.target.value)} /></td>
                        <td><input className="table-input" type="number" value={hazard.width ?? ""} onChange={(event) => updateHazard(index, "width", event.target.value)} /></td>
                        <td><input className="table-input" type="number" value={hazard.depth ?? ""} onChange={(event) => updateHazard(index, "depth", event.target.value)} /></td>
                        <td><input className="table-input" type="number" value={hazard.penalty_strokes} onChange={(event) => updateHazard(index, "penalty_strokes", event.target.value)} /></td>
                        <td><button className="danger-link" type="button" onClick={() => updateHoleField("hazards", holeForm.hazards.filter((_, row) => row !== index))}>Remove</button></td>
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

          <HoleMap
            hole={holeForm}
            title="Live hole preview"
            subtitle="The map updates immediately as you edit geometry, wind, and hazards."
            startPosition={holeForm.tee}
            targetPosition={holeForm.green_center}
          />
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
            Manage player profiles and holes, run tee-shot or custom-shot recommendations, and review saved strategy history from the local FastAPI and SQLite stack.
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

      {notice ? <div className="success-banner">{notice}</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}

      {view === "strategy" ? renderStrategyView() : null}
      {view === "players" ? renderPlayersView() : null}
      {view === "holes" ? renderHolesView() : null}
      {view === "history" ? renderHistoryView() : null}
    </div>
  );
}

export default App;
