"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  BrainCircuit,
  FileCode2,
  Loader2,
  Radar,
  Search,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import {
  severityOrder,
  severityStyles,
  SeverityBadge,
} from "@/lib/severity";
import type { Finding, Severity } from "@/lib/types";
import { cn } from "@/lib/utils";

const sampleFindings: Finding[] = [
  {
    id: 1,
    tool: "bandit",
    rule_id: "B608",
    severity: "high",
    file_path: "app/auth.py",
    line_start: 14,
    line_end: 14,
    message: "Potential hardcoded password: hardcoded_password_string",
    ai_explanation:
      "This code embeds a plaintext password directly in source. Anyone with read access to the repository can extract it. Replace with a secret-vault reference or environment variable.",
    root_cause: "Developer convenience made the secret a literal in a constants module.",
  },
  {
    id: 2,
    tool: "semgrep",
    rule_id: "python.lang.security.sql-injection",
    severity: "critical",
    file_path: "app/db.py",
    line_start: 42,
    line_end: 45,
    message: "SQL statement built from unsanitized user input",
    ai_explanation:
      "User-supplied input is interpolated directly into a SQL string. An attacker can inject arbitrary SQL. Use parameterized queries or an ORM to bind values safely.",
    root_cause: "Query built via f-string instead of a parameterized cursor.execute.",
  },
  {
    id: 3,
    tool: "gitleaks",
    rule_id: "generic-api-key",
    severity: "medium",
    file_path: ".env.example",
    line_start: 3,
    line_end: 3,
    message: "Detected a possible API key in source",
    ai_explanation:
      "A token-shaped string was found. It has been redacted before reaching any external LLM. Rotate the key and store it in the encrypted vault.",
    root_cause: "Example environment file committed with a placeholder that looks like a key.",
  },
  {
    id: 4,
    tool: "ruff",
    rule_id: "S105",
    severity: "low",
    file_path: "worker.py",
    line_start: 20,
    line_end: 20,
    message: "Hardcoded temporary admin password",
    ai_explanation:
      "A default password is set in code. While usable for local dev, it must not ship to production.",
    root_cause: "Bootstrap script uses a static default credential.",
  },
  {
    id: 5,
    tool: "eslint",
    rule_id: "no-unused-vars",
    severity: "info",
    file_path: "src/index.ts",
    line_start: 7,
    line_end: 7,
    message: "'foo' is defined but never used",
    ai_explanation:
      "Dead code increases maintenance cost. Removing unused bindings keeps the codebase clean.",
    root_cause: "Leftover variable from an earlier refactor.",
  },
];

export default function FindingsPage() {
  const analyses = useQuery({ queryKey: ["analyses"], queryFn: api.analyses });
  const [selectedSeverity, setSelectedSeverity] = useState<Severity | "all">("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Finding | null>(null);

  const latestCompleted = useMemo(
    () =>
      (analyses.data ?? []).find((a) => a.status === "completed") ??
      (analyses.data ?? [])[0],
    [analyses.data]
  );

  const findingsQuery = useQuery({
    queryKey: ["findings", latestCompleted?.id],
    queryFn: () => api.findings(latestCompleted!.id),
    enabled: !!latestCompleted,
  });

  const liveFindings = findingsQuery.data ?? [];
  const findings: Finding[] =
    liveFindings.length > 0 ? liveFindings : sampleFindings;

  const filtered = findings.filter((f) => {
    const sevOk = selectedSeverity === "all" || f.severity === selectedSeverity;
    const q = query.toLowerCase();
    const textOk =
      !q ||
      (f.file_path ?? "").toLowerCase().includes(q) ||
      f.message.toLowerCase().includes(q) ||
      (f.rule_id ?? "").toLowerCase().includes(q);
    return sevOk && textOk;
  });

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const f of findings) c[f.severity] = (c[f.severity] ?? 0) + 1;
    return c;
  }, [findings]);

  const activeFinding = selected ?? filtered[0] ?? null;

  return (
    <div>
      <PageHeader
        title="Findings Explorer"
        description="Investigate findings with severity, CVSS, and AI explanations"
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={selectedSeverity === "all" ? "default" : "outline"}
          onClick={() => setSelectedSeverity("all")}
        >
          All ({findings.length})
        </Button>
        {severityOrder.map((sev) => (
          <Button
            key={sev}
            size="sm"
            variant={selectedSeverity === sev ? "default" : "outline"}
            onClick={() => setSelectedSeverity(sev)}
            className="capitalize"
          >
            {sev} ({counts[sev] ?? 0})
          </Button>
        ))}
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by file, message, or rule…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Radar className="h-4 w-4 text-primary" />
              Findings
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-[70vh] space-y-2 overflow-y-auto p-4">
            {filtered.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No findings match your filters.
              </p>
            ) : (
              filtered.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setSelected(f)}
                  className={cn(
                    "w-full rounded-md border p-3 text-left transition-colors",
                    activeFinding?.id === f.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/40"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <SeverityBadge severity={f.severity} />
                    <span className="text-xs text-muted-foreground">{f.tool}</span>
                  </div>
                  <p className="mt-2 text-sm font-medium leading-snug">{f.message}</p>
                  <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <FileCode2 className="h-3 w-3 shrink-0" />
                    {f.file_path ?? "unknown"}
                    {f.line_start ? `:${f.line_start}` : ""}
                  </p>
                  {f.vulnerability?.cvss_score != null && (
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">
                        {f.vulnerability.identifier}
                      </span>
                      <Badge variant="destructive" className="gap-1">
                        CVSS {f.vulnerability.cvss_score.toFixed(1)}
                      </Badge>
                    </div>
                  )}
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              AI Investigation
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeFinding ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <SeverityBadge severity={activeFinding.severity} />
                  <span className="font-mono text-xs text-muted-foreground">
                    {activeFinding.rule_id ?? activeFinding.tool}
                  </span>
                </div>

                <div className="rounded-md bg-muted p-3 font-mono text-xs">
                  <span className="text-muted-foreground">{activeFinding.file_path}</span>
                  <span className="text-primary">
                    {activeFinding.line_start ? `:${activeFinding.line_start}` : ""}
                  </span>
                  <pre className="mt-2 whitespace-pre-wrap text-foreground">
                    {activeFinding.message}
                  </pre>
                </div>

                <div>
                  <h4 className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
                    <BrainCircuit className="h-3.5 w-3.5" />
                    Summary Agent · Explanation
                  </h4>
                  <p className="text-sm leading-relaxed">
                    {activeFinding.ai_explanation ??
                      "No AI explanation yet. Download the Summary Agent or run an analysis to generate it."}
                  </p>
                </div>

                {activeFinding.root_cause && (
                  <div>
                    <h4 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                      Debug Agent · Root cause
                    </h4>
                    <p className="text-sm leading-relaxed">{activeFinding.root_cause}</p>
                  </div>
                )}

                {findingsQuery.isLoading && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading live findings…
                  </div>
                )}
              </div>
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Select a finding to see its AI investigation.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
