export interface HealthService {
  name: string;
  key: string;
}

export interface HealthResponse {
  status: string;
  version: string;
  services: Record<string, string>;
}

export interface Repository {
  id: number;
  name: string;
  url: string | null;
  default_branch: string;
  size_bytes: number;
  file_count: number;
  is_sample: boolean;
  created_at: string;
}

export type AnalysisStatus = "queued" | "running" | "completed" | "failed";

export interface Analysis {
  id: number;
  repository_id: number;
  status: AnalysisStatus;
  commit_sha: string | null;
  error: string | null;
  progress: number | null;
  progress_message: string | null;
  created_at: string;
  updated_at: string;
}

export type Severity = "info" | "low" | "medium" | "high" | "critical";

export interface Finding {
  id: number;
  tool: string;
  rule_id: string | null;
  severity: Severity;
  file_path: string | null;
  line_start: number | null;
  line_end: number | null;
  message: string;
  ai_explanation: string | null;
  root_cause: string | null;
  patch?: string | null;
  raw_data?: {
    package?: string;
    version?: string;
    ecosystem?: string;
    identifier?: string;
    cvss_score?: number | null;
    fixed_version?: string | null;
  } | null;
  vulnerability?: {
    identifier: string;
    source: string;
    cvss_score: number | null;
    summary: string | null;
    patched_versions: string[] | null;
  };
}

export interface IntegrationStatus {
  providers: Record<string, string>;
  active_llm: string;
  usage: Record<string, unknown>;
}

export interface ProviderUsage {
  requests: number;
  errors: number;
  latency_sum_ms: number;
  cache_hits: number;
  cache_misses: number;
  rate_remaining: number | null;
  rate_reset_at: string | null;
  last_request: string | null;
}

export type IntegrationUsage = Record<string, ProviderUsage>;
