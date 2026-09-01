import type {
  Analysis,
  Finding,
  HealthResponse,
  IntegrationUsage,
  Repository,
} from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(`${API_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      ...init,
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`API ${res.status}: ${detail}`);
    }
    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timeout);
  }
}

export const api = {
  health: () => request<HealthResponse>("/health"),

  integrationStatus: () =>
    request<{ providers: Record<string, string>; active_llm: string; usage: unknown }>(
      "/api/integrations/status"
    ),

  repositories: () => request<Repository[]>("/api/repositories"),
  createRepository: (data: { name: string; url?: string; default_branch?: string }) =>
    request<{ id: number; name: string }>("/api/repositories", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  analyses: () => request<Analysis[]>("/api/analyses"),
  createAnalysis: (data: { repository_id: number; commit_sha?: string }) =>
    request<Analysis>("/api/analyses", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  findings: (analysisId: number) => request<Finding[]>(`/api/analyses/${analysisId}`),

  analyze: (data: { content: string; task?: string }) =>
    request<{ task: string; redacted: boolean; explanation: string }>("/api/analyze", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

export type { IntegrationUsage };
