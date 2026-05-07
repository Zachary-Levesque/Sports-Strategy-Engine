import { useEffect, useMemo, useState } from "react";

import { getHealth, getHoles, getPlayers, getRecommendation } from "./api/client";
import { AlternativesTable } from "./components/AlternativesTable";
import { HoleSelector } from "./components/HoleSelector";
import { PlayerSelector } from "./components/PlayerSelector";
import { ProbabilityBreakdown } from "./components/ProbabilityBreakdown";
import { RecommendationCard } from "./components/RecommendationCard";
import type {
  HoleSummary,
  PlayerSummary,
  RecommendationResponse,
  RiskTolerance,
} from "./types";

const riskOptions: Array<{ label: string; value: RiskTolerance }> = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
];

function App() {
  const [players, setPlayers] = useState<PlayerSummary[]>([]);
  const [holes, setHoles] = useState<HoleSummary[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [selectedHole, setSelectedHole] = useState("");
  const [iterations, setIterations] = useState(2000);
  const [riskTolerance, setRiskTolerance] = useState<RiskTolerance>("medium");
  const [healthStatus, setHealthStatus] = useState("Checking backend...");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<RecommendationResponse | null>(null);

  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoading(true);
        setError("");
        const [health, playerData, holeData] = await Promise.all([
          getHealth(),
          getPlayers(),
          getHoles(),
        ]);
        setHealthStatus(health.status === "ok" ? "Backend online" : "Backend unavailable");
        setPlayers(playerData);
        setHoles(holeData);

        if (playerData.length > 0) {
          setSelectedPlayer(playerData[0].player_name);
          setRiskTolerance(playerData[0].risk_tolerance);
        }
        if (holeData.length > 0) {
          setSelectedHole(holeData[0].hole_id);
        }
      } catch (loadError) {
        setHealthStatus("Backend unreachable");
        setError(loadError instanceof Error ? loadError.message : "Failed to load backend data.");
      } finally {
        setLoading(false);
      }
    }

    void loadInitialData();
  }, []);

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
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to fetch recommendation.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="hero__kicker">Personalized Monte Carlo golf strategy</p>
          <h1>Sports Strategy Engine</h1>
          <p className="hero__subtitle">
            Compare club, aim point, shape, and swing intensity against the current
            hole and player profile.
          </p>
        </div>
        <div className={`status ${healthStatus === "Backend online" ? "status--ok" : "status--warn"}`}>
          {healthStatus}
        </div>
      </header>

      <main className="layout">
        <section className="control-panel card">
          <div className="card__header">
            <div>
              <p className="eyebrow">Inputs</p>
              <h2>Run Recommendation</h2>
            </div>
          </div>

          {loading ? (
            <div className="state-message">Loading player and hole data...</div>
          ) : (
            <>
              <PlayerSelector
                players={players}
                value={selectedPlayer}
                onChange={setSelectedPlayer}
              />
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
                    <option key={option.value} value={option.value}>
                      {option.label}
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
                {activePlayer.player_name} is a {activePlayer.handedness}-handed player,
                prefers a {activePlayer.preferred_shape}, and carries {activePlayer.club_count} tracked clubs.
              </p>
            </div>
          ) : null}

          {activeHole ? (
            <div className="summary-block">
              <h3>Selected Hole</h3>
              <p>
                {activeHole.name} is a par {activeHole.par} measuring {activeHole.yardage} yards with
                wind at {activeHole.wind_speed_mph} mph from {activeHole.wind_direction_deg} degrees.
              </p>
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
              <p>
                Choose a player and hole, then run the engine to compare strategies and
                inspect the recommendation breakdown.
              </p>
            </section>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
