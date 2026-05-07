import type {
  HealthResponse,
  HoleDetail,
  HolePayload,
  HoleSummary,
  PlayerDetail,
  PlayerPayload,
  PlayerSummary,
  RecommendationHistoryItem,
  RecommendationRequest,
  RecommendationResponse,
  ScenarioSummary,
} from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload.detail) {
        message = payload.detail;
      }
    } catch {
      message = response.statusText || message;
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function getHealth(): Promise<HealthResponse> {
  return requestJson<HealthResponse>("/health");
}

export function getPlayers(): Promise<PlayerSummary[]> {
  return requestJson<PlayerSummary[]>("/players");
}

export function getPlayer(playerName: string): Promise<PlayerDetail> {
  return requestJson<PlayerDetail>(`/players/${encodeURIComponent(playerName)}`);
}

export function createPlayer(payload: PlayerPayload): Promise<PlayerDetail> {
  return requestJson<PlayerDetail>("/players", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updatePlayer(playerName: string, payload: PlayerPayload): Promise<PlayerDetail> {
  return requestJson<PlayerDetail>(`/players/${encodeURIComponent(playerName)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deletePlayer(playerName: string): Promise<void> {
  return requestJson<void>(`/players/${encodeURIComponent(playerName)}`, {
    method: "DELETE",
  });
}

export function getHoles(): Promise<HoleSummary[]> {
  return requestJson<HoleSummary[]>("/holes");
}

export function getHole(holeId: string): Promise<HoleDetail> {
  return requestJson<HoleDetail>(`/holes/${encodeURIComponent(holeId)}`);
}

export function createHole(payload: HolePayload): Promise<HoleDetail> {
  return requestJson<HoleDetail>("/holes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateHole(holeId: string, payload: HolePayload): Promise<HoleDetail> {
  return requestJson<HoleDetail>(`/holes/${encodeURIComponent(holeId)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteHole(holeId: string): Promise<void> {
  return requestJson<void>(`/holes/${encodeURIComponent(holeId)}`, {
    method: "DELETE",
  });
}

export function getScenarios(): Promise<ScenarioSummary[]> {
  return requestJson<ScenarioSummary[]>("/scenarios");
}

export function getRecommendation(
  payload: RecommendationRequest,
): Promise<RecommendationResponse> {
  return requestJson<RecommendationResponse>("/recommendation", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getRecommendationHistory(): Promise<RecommendationHistoryItem[]> {
  return requestJson<RecommendationHistoryItem[]>("/recommendations/history");
}
