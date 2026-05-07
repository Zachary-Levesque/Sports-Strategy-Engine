import type { PlayerSummary } from "../types";

interface PlayerSelectorProps {
  players: PlayerSummary[];
  value: string;
  onChange: (value: string) => void;
}

export function PlayerSelector({
  players,
  value,
  onChange,
}: PlayerSelectorProps) {
  return (
    <label className="field">
      <span className="field__label">Player Profile</span>
      <select
        className="field__control"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {players.map((player) => (
          <option key={player.player_name} value={player.player_name}>
            {player.player_name} · HCP {player.handicap} · {player.preferred_shape}
          </option>
        ))}
      </select>
    </label>
  );
}
