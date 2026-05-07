import type {
  HealthResponse,
  HoleSummary,
  PlayerSummary,
  RecommendationRequest,
  RecommendationResponse,
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

  return (await response.json()) as T;
}

export function getHealth(): Promise<HealthResponse> {
  return requestJson<HealthResponse>("/health");
}

export function getPlayers(): Promise<PlayerSummary[]> {
  return requestJson<PlayerSummary[]>("/players");
}

export function getHoles(): Promise<HoleSummary[]> {
  return requestJson<HoleSummary[]>("/holes");
}

export function getRecommendation(
  payload: RecommendationRequest,
): Promise<RecommendationResponse> {
  return requestJson<RecommendationResponse>("/recommendation", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
